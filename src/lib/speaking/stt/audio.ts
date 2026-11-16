import { SttError } from "./config";

export type AudioInfo = { durationMs: number; extension: "webm" | "ogg" | "mp4"; mime: string };
const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

/** Bounds-checked container metadata reader. Unsupported codecs/structures fail closed. */
export function inspectAudio(bytes: Uint8Array): AudioInfo {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fits = (at: number, n: number) => at >= 0 && at + n <= bytes.length;
  let durationMs = 0;
  let extension: AudioInfo["extension"];
  try {
    if (ascii(bytes, 0, 4) === "OggS") {
      extension = "ogg";
      let at = 0, pages = 0, last = 0, serial: number | undefined, preSkip: number | undefined;
      while (at < bytes.length) {
        if (++pages > 20000 || !fits(at, 27) || ascii(bytes, at, 4) !== "OggS" || bytes[at + 4] !== 0) throw 0;
        const stream = view.getUint32(at + 14, true);
        if (serial !== undefined && serial !== stream) throw 0;
        serial = stream;
        const count = bytes[at + 26];
        if (!fits(at + 27, count)) throw 0;
        let size = 0;
        for (let i = 0; i < count; i++) size += bytes[at + 27 + i];
        const start = at + 27 + count;
        if (!fits(start, size)) throw 0;
        if (pages === 1) {
          if (size < 19 || ascii(bytes, start, 8) !== "OpusHead") throw 0;
          preSkip = view.getUint16(start + 10, true);
        }
        const granule = view.getBigUint64(at + 6, true);
        if (granule !== BigInt("18446744073709551615")) {
          if (granule > BigInt(Number.MAX_SAFE_INTEGER)) throw 0;
          last = Number(granule);
        }
        at = start + size;
      }
      durationMs = (last - (preSkip ?? 0)) / 48;
    } else if (fits(0, 12) && ascii(bytes, 4, 4) === "ftyp") {
      extension = "mp4";
      let boxes = 0;
      const scan = (start: number, end: number, depth: number) => {
        if (depth > 4) throw 0;
        for (let at = start; at < end;) {
          if (++boxes > 20000 || at + 8 > end) throw 0;
          let size = view.getUint32(at), header = 8;
          if (size === 1) {
            if (at + 16 > end) throw 0;
            const big = view.getBigUint64(at + 8);
            if (big > BigInt(Number.MAX_SAFE_INTEGER)) throw 0;
            size = Number(big); header = 16;
          }
          if (size === 0) size = end - at;
          if (size < header || at + size > end) throw 0;
          const type = ascii(bytes, at + 4, 4), body = at + header;
          if (type === "moov") scan(body, at + size, depth + 1);
          if (type === "mvhd" && depth === 1) {
            const version = bytes[body], offset = version === 1 ? 20 : 12;
            if ((version !== 0 && version !== 1) || body + offset + (version === 1 ? 12 : 8) > at + size) throw 0;
            const scale = view.getUint32(body + offset);
            const ticks = version === 1 ? Number(view.getBigUint64(body + offset + 4)) : view.getUint32(body + offset + 4);
            if (!scale || !Number.isSafeInteger(ticks)) throw 0;
            durationMs = ticks * 1000 / scale;
          }
          at += size;
        }
      };
      scan(0, bytes.length, 0);
    } else if (fits(0, 4) && view.getUint32(0) === 0x1a45dfa3) {
      extension = "webm";
      let elements = 0, scale = 1000000, endTicks = -1, opus = false;
      // Elements that can only sit directly under the Segment: they end an unknown-size Cluster.
      const segmentLevel = [0x1f43b675, 0x1c53bb6b, 0x1254c367, 0x1043a770, 0x1941a469, 0x114d9b74, 0x1549a966, 0x1654ae6b];
      const vint = (at: number, id = false) => {
        if (!fits(at, 1) || bytes[at] === 0) throw 0;
        let n = 1, mask = 128;
        while (!(bytes[at] & mask)) { mask >>= 1; n++; }
        if (n > (id ? 4 : 8) || !fits(at, n)) throw 0;
        let value = id ? bytes[at] : bytes[at] & (mask - 1);
        for (let i = 1; i < n; i++) value = value * 256 + bytes[at + i];
        return { n, value, unknown: !id && value === 2 ** (7 * n) - 1 };
      };
      const integer = (at: number, n: number) => {
        if (n < 1 || n > 6) throw 0;
        let value = 0;
        for (let i = 0; i < n; i++) value = value * 256 + bytes[at + i];
        return value;
      };
      const scan = (start: number, end: number, depth: number, cluster?: { time: number }) => {
        if (depth > 6) throw 0;
        for (let at = start; at < end;) {
          if (++elements > 100000) throw 0;
          const id = vint(at, true), size = vint(at + id.n), body = at + id.n + size.n;
          // Live MediaRecorder output (any start(timeslice), as the app records) has an unknown-size Segment AND
          // unknown-size Clusters. An unknown-size Cluster runs until the next segment-level element or the end.
          if (size.unknown && id.value !== 0x18538067 && id.value !== 0x1f43b675) throw 0;
          let stop = size.unknown ? end : body + size.value;
          if (size.unknown && id.value === 0x1f43b675) {
            for (let child = body; child < end;) {
              if (++elements > 100000) throw 0;
              const childId = vint(child, true), childSize = vint(child + childId.n);
              if (segmentLevel.includes(childId.value)) { stop = child; break; }
              if (childSize.unknown) throw 0;
              child += childId.n + childSize.n + childSize.value;
              if (!Number.isSafeInteger(child)) throw 0;
            }
          }
          if (!Number.isSafeInteger(stop) || stop > end || stop < body) throw 0;
          if ([0x18538067, 0x1549a966, 0x1654ae6b, 0xae, 0x1f43b675, 0xa0].includes(id.value)) scan(body, stop, depth + 1, id.value === 0x1f43b675 ? { time: 0 } : cluster);
          else if (id.value === 0x86) {
            if (ascii(bytes, body, stop - body) !== "A_OPUS") throw 0;
            opus = true;
          }
          else if (id.value === 0x2ad7b1) scale = integer(body, stop - body);
          else if (id.value === 0xe7 && cluster) cluster.time = integer(body, stop - body);
          else if ((id.value === 0xa3 || id.value === 0xa1) && cluster) {
            const track = vint(body);
            if (body + track.n + 3 >= stop) throw 0;
            // Reject lacing instead of guessing packet boundaries. Opus TOC gives
            // the last packet's duration, so billing includes its full endpoint.
            if (bytes[body + track.n + 2] & 6) throw 0;
            const packet = body + track.n + 3, toc = bytes[packet], config = toc >> 3;
            const frameMs = config >= 16 ? 2.5 * 2 ** (config & 3) : config >= 12 ? 10 * 2 ** (config & 1) : (config & 3) === 3 ? 60 : 10 * 2 ** (config & 3);
            const code = toc & 3;
            if (code === 3 && packet + 1 >= stop) throw 0;
            const frames = code === 0 ? 1 : code === 3 ? bytes[packet + 1] & 63 : 2;
            const packetMs = frameMs * frames;
            if (!frames || packetMs > 120 || scale <= 0) throw 0;
            endTicks = Math.max(endTicks, cluster.time + view.getInt16(body + track.n) + packetMs * 1000000 / scale);
          }
          at = stop;
        }
      };
      scan(0, bytes.length, 0);
      if (!opus) throw 0;
      durationMs = endTicks * scale / 1000000;
    } else throw new SttError("invalid_audio");
  } catch (error) {
    if (error instanceof SttError) throw error;
    throw new SttError("duration_unverifiable");
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new SttError("duration_unverifiable");
  return { extension, mime: `audio/${extension}`, durationMs: Math.ceil(durationMs) };
}
