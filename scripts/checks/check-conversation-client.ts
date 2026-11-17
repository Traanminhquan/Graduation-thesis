import assert from "node:assert/strict";
import {
  createTurnRecorder, isTurnRecordingSupported, pickMimeType, TurnRecorderError,
  type TurnRecorderDeps, type TurnRecorderOptions,
} from "../../src/lib/conversation/turn-recorder";
import { createSpeakQueue, pickEnglishVoice } from "../../src/lib/conversation/speak-queue";

// These objects never touch a real browser, microphone, provider or database.
function recordingHarness(options: Partial<TurnRecorderOptions> = {}) {
  let time = 1000;
  let rms = 0;
  let requests = 0;
  let closed = 0;
  let disconnected = 0;
  let permissionError: string | undefined;
  let constraints: MediaStreamConstraints | undefined;
  let startDelay = 0;
  let stopDelay = 0;
  const tracks = [{ stops: 0, stop() { this.stops++; } }, { stops: 0, stop() { this.stops++; } }];
  const stream = { getTracks: () => tracks } as unknown as MediaStream;
  const timers = new Map<number, () => void>();
  let timerId = 0;
  const instances: Recorder[] = [];
  class Recorder {
    static supported = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"];
    static isTypeSupported(type: string) { return this.supported.includes(type); }
    state = "inactive";
    mimeType = "audio/fake-actual";
    onstart: (() => void) | null = null;
    onstop: (() => void) | null = null;
    onerror: (() => void) | null = null;
    ondataavailable: ((event: { data: Blob }) => void) | null = null;
    constructor(public stream: MediaStream, public options: MediaRecorderOptions) { instances.push(this); }
    start() { time += startDelay; this.state = "recording"; this.onstart?.(); }
    stop() {
      this.state = "inactive";
      this.ondataavailable?.({ data: new Blob(["first"]) });
      this.ondataavailable?.({ data: new Blob(["second"]) });
      time += stopDelay;
      this.onstop?.();
    }
  }
  class Context {
    state = "running";
    createMediaStreamSource() {
      return { connect() {}, disconnect() { disconnected++; } };
    }
    createAnalyser() {
      return {
        fftSize: 0,
        getFloatTimeDomainData(data: Float32Array) { assert.equal(this.fftSize, 1024); data.fill(rms); },
        disconnect() { disconnected++; },
      };
    }
    async close() { closed++; }
  }
  const deps: TurnRecorderDeps = {
    mediaDevices: { async getUserMedia(value: MediaStreamConstraints) {
      requests++;
      constraints = value;
      if (permissionError) throw { name: permissionError };
      return stream;
    } } as MediaDevices,
    MediaRecorder: Recorder as unknown as typeof MediaRecorder,
    AudioContext: Context as unknown as typeof AudioContext,
    now: () => time,
    setInterval: ((callback: () => void, ms: number) => {
      assert.equal(ms, 50);
      timers.set(++timerId, callback);
      return timerId;
    }) as unknown as typeof setInterval,
    clearInterval: ((id: number) => { timers.delete(id); }) as unknown as typeof clearInterval,
  };
  const recorder = createTurnRecorder({ maxMs: 30000, ...options }, deps);
  return {
    recorder, deps, tracks, instances, timers,
    get requests() { return requests; },
    get closed() { return closed; },
    get disconnected() { return disconnected; },
    get constraints() { return constraints; },
    error(name: string) { permissionError = name; },
    delays(start: number, stop: number) { startDelay = start; stopDelay = stop; },
    tick(ms: number, level = 0) {
      rms = level;
      for (let elapsed = 0; elapsed < ms; elapsed += 50) {
        time += 50;
        for (const callback of [...timers.values()]) callback();
      }
    },
  };
}

function speechHarness() {
  const spoken: Utterance[] = [];
  let live: Utterance | undefined;
  let cancels = 0;
  class Utterance {
    lang = "";
    rate = 0;
    voice: SpeechSynthesisVoice | null = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const synth = {
    speak(utterance: Utterance) {
      assert.equal(live, undefined, "at most one browser utterance");
      live = utterance;
      spoken.push(utterance);
    },
    cancel() { cancels++; live = undefined; },
  } as unknown as SpeechSynthesis;
  return {
    deps: { synth, Utterance: Utterance as unknown as typeof SpeechSynthesisUtterance },
    spoken,
    get cancels() { return cancels; },
    finish(error = false) {
      assert.ok(live);
      const previous = live;
      live = undefined;
      if (error) previous.onerror?.(); else previous.onend?.();
    },
  };
}

async function main() {
  const mime = recordingHarness();
  const Constructor = mime.deps.MediaRecorder!;
  assert.equal(pickMimeType(Constructor), "audio/webm;codecs=opus");
  const types = ["audio/ogg;codecs=opus", "audio/mp4"];
  const supported = { isTypeSupported: (type: string) => types.includes(type) } as typeof MediaRecorder;
  assert.equal(pickMimeType(supported), types[0]);
  types.shift();
  assert.equal(pickMimeType(supported), "audio/mp4");
  types.shift();
  assert.equal(pickMimeType(supported), undefined);
  assert.equal(pickMimeType({} as typeof MediaRecorder), undefined);
  assert.equal(pickMimeType({ isTypeSupported() { throw Error(); } } as unknown as typeof MediaRecorder), undefined);
  assert.equal(isTurnRecordingSupported(), false);

  for (const [name, reason] of [
    ["NotAllowedError", "permission"], ["SecurityError", "permission"],
    ["NotFoundError", "no_device"], ["OverconstrainedError", "no_device"], ["NotReadableError", "failed"],
  ]) {
    const h = recordingHarness();
    h.error(name);
    await assert.rejects(h.recorder.start(), (error: unknown) => error instanceof TurnRecorderError && error.reason === reason);
    h.recorder.release();
  }
  for (const missing of ["MediaRecorder", "mediaDevices"] as const) {
    const deps = { ...mime.deps, [missing]: undefined };
    const unsupported = createTurnRecorder({ maxMs: 1000 }, deps);
    await assert.rejects(unsupported.start(), { reason: "unsupported" });
    unsupported.release();
  }

  const h = recordingHarness();
  h.delays(125, 75);
  for (let turn = 0; turn < 3; turn++) {
    await Promise.all([h.recorder.start(), h.recorder.start()]);
    assert.equal(h.recorder.recording, true);
    await h.recorder.start();
    const pending = h.recorder.next();
    h.tick(500);
    h.recorder.stop();
    h.recorder.stop();
    const result = await pending;
    assert.equal(result.reason, "manual");
    assert.equal(result.recording.durationMs, 575, "clock from start event through stop event");
    assert.equal(result.recording.mimeType, "audio/fake-actual");
    assert.equal(result.recording.blob.type, "audio/fake-actual");
    assert.equal(await result.recording.blob.text(), "firstsecond");
    assert.equal(h.recorder.recording, false);
  }
  assert.equal(h.requests, 1);
  assert.equal(h.instances.length, 3);
  for (const instance of h.instances) {
    assert.equal(instance.options.audioBitsPerSecond, 32000);
    assert.equal(instance.options.mimeType, "audio/webm;codecs=opus");
  }
  assert.deepEqual(h.constraints, { audio: {
    channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
  } });
  assert.ok(h.tracks.every((track) => track.stops === 0));
  await h.recorder.start();
  const rejected = assert.rejects(h.recorder.next(), { reason: "failed" });
  h.recorder.release();
  h.recorder.release();
  await rejected;
  assert.ok(h.tracks.every((track) => track.stops === 1));
  assert.equal(h.closed, 1);
  assert.equal(h.disconnected, 2);
  assert.equal(h.timers.size, 0);
  await assert.rejects(h.recorder.start(), { reason: "failed" });

  let meters = 0;
  const silence = recordingHarness({ level() { meters++; } });
  await silence.recorder.start();
  const silentResult = silence.recorder.next();
  silence.tick(300);
  silence.tick(200, 0.1);
  silence.tick(2000);
  assert.equal(silence.recorder.recording, true, "short speech cannot arm silence stop");
  silence.tick(200, 0.1);
  silence.tick(1450);
  assert.equal(silence.recorder.recording, true, "require the full continuous silence window");
  silence.tick(50);
  assert.equal((await silentResult).reason, "silence");
  assert.ok(meters > 0);
  silence.recorder.release();

  const noisy = recordingHarness({ noSpeechTimeoutMs: 1000 });
  await noisy.recorder.start();
  const noisyResult = noisy.recorder.next();
  noisy.tick(300, 0.05);
  noisy.tick(700, 0.08);
  assert.equal((await noisyResult).reason, "no_speech", "noise floor raises threshold above 0.08");
  noisy.recorder.release();
  for (const [options, ms, reason] of [
    [{ maxMs: 1000 }, 1000, "limit"],
    [{}, 8000, "no_speech"],
  ] as const) {
    const limit = recordingHarness(options);
    const pending = limit.recorder.next(); // Also supports subscribing before start.
    await limit.recorder.start();
    limit.tick(ms);
    assert.equal((await pending).reason, reason);
    limit.recorder.release();
  }

  // A released permission request must not leak the stream when it arrives late.
  const late = recordingHarness();
  let allow: (stream: MediaStream) => void = () => {};
  late.deps.mediaDevices = { getUserMedia: () => new Promise<MediaStream>((resolve) => { allow = resolve; }) } as MediaDevices;
  const lateRecorder = createTurnRecorder({ maxMs: 1000 }, late.deps);
  const lateStart = assert.rejects(lateRecorder.start(), { reason: "failed" });
  lateRecorder.release();
  allow({ getTracks: () => late.tracks } as unknown as MediaStream);
  await lateStart;
  assert.ok(late.tracks.every((track) => track.stops === 1));

  const speech = speechHarness();
  const queue = createSpeakQueue({}, speech.deps);
  let idles = 0;
  queue.onIdle(() => { idles++; });
  queue.push("Sure. Would you like");
  assert.deepEqual(speech.spoken.map((u) => u.text), ["Sure."]);
  assert.equal(speech.spoken[0].lang, "en-GB");
  assert.equal(speech.spoken[0].rate, 1);
  queue.push(" a 6.");
  queue.push("30 table? Great!");
  assert.equal(speech.spoken.length, 1);
  speech.finish();
  assert.equal(speech.spoken[1].text, "Would you like a 6.30 table?");
  speech.finish(true);
  assert.equal(idles, 0);
  queue.end();
  assert.equal(speech.spoken[2].text, "Great!");
  speech.finish();
  assert.equal(idles, 1);
  assert.equal(queue.speaking, false);
  queue.push("Complete. unfinished");
  const cancelled = speech.spoken.at(-1)!;
  queue.cancel();
  cancelled.onend?.();
  assert.equal(speech.cancels, 1);
  assert.equal(queue.speaking, false);
  assert.equal(idles, 1);
  queue.push("Fresh tail");
  queue.end();
  assert.equal(speech.spoken.at(-1)!.text, "Fresh tail");
  speech.finish();
  assert.equal(idles, 2);

  const unavailable = createSpeakQueue();
  let unavailableIdle = 0;
  unavailable.onIdle(() => { unavailableIdle++; });
  unavailable.push("Ignored.");
  assert.equal(unavailable.speaking, false);
  unavailable.end();
  assert.equal(unavailableIdle, 1);
  unavailable.cancel();
  assert.equal(unavailableIdle, 1);
  const voice = (lang: string, localService = false) => ({ lang, localService }) as SpeechSynthesisVoice;
  const remote = voice("en-AU");
  const gb = voice("en-GB", true);
  const us = voice("en-US", true);
  assert.equal(pickEnglishVoice([remote, gb]), gb);
  assert.equal(pickEnglishVoice([remote, us]), us);
  assert.equal(pickEnglishVoice([voice("fr-FR"), remote]), remote);
  assert.equal(pickEnglishVoice([voice("fr-FR")]), null);
  assert.equal(pickEnglishVoice([]), null);
  console.log("PASS conversation client: recorder lifecycle, VAD, MIME, cleanup and streamed speech queue (offline fakes)");
}

void main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
