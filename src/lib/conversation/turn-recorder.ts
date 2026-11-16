export type TurnRecording = { blob: Blob; durationMs: number; mimeType: string };
export type TurnRecorderOptions = {
  maxMs: number;
  silenceMs?: number;
  minSpeechMs?: number;
  noSpeechTimeoutMs?: number;
  level?: (rms: number) => void;
};
export type StopReason = "manual" | "silence" | "limit" | "no_speech";
export type TurnRecorderDeps = {
  mediaDevices?: MediaDevices;
  MediaRecorder?: typeof MediaRecorder;
  AudioContext?: typeof AudioContext;
  now?: () => number;
  setInterval?: typeof setInterval;
  clearInterval?: typeof clearInterval;
};

export class TurnRecorderError extends Error {
  constructor(public readonly reason: "unsupported" | "permission" | "no_device" | "failed") {
    super(`Turn recording: ${reason}`);
    this.name = "TurnRecorderError";
  }
}

export interface TurnRecorder {
  start(): Promise<void>;
  stop(): void;
  readonly recording: boolean;
  next(): Promise<{ recording: TurnRecording; reason: StopReason }>;
  release(): void;
}

export function pickMimeType(
  MediaRecorderImpl = globalThis.MediaRecorder,
): string | undefined {
  return ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((type) => {
    try {
      return MediaRecorderImpl?.isTypeSupported?.(type) === true;
    } catch {
      return false;
    }
  });
}

export function isTurnRecordingSupported(): boolean {
  return typeof globalThis.navigator?.mediaDevices?.getUserMedia === "function"
    && typeof globalThis.MediaRecorder === "function"
    && typeof globalThis.AudioContext === "function";
}

type Result = { recording: TurnRecording; reason: StopReason };

export function createTurnRecorder(options: TurnRecorderOptions, deps: TurnRecorderDeps = {}): TurnRecorder {
  const devices = deps.mediaDevices ?? globalThis.navigator?.mediaDevices;
  const Recorder = deps.MediaRecorder ?? globalThis.MediaRecorder;
  const Context = deps.AudioContext ?? globalThis.AudioContext;
  const now = deps.now ?? (() => performance.now());
  const every = deps.setInterval ?? globalThis.setInterval;
  const clear = deps.clearInterval ?? globalThis.clearInterval;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let recorder: MediaRecorder | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let starting: Promise<void> | undefined;
  let released = false;
  let active = false;
  let stopping = false;
  let settled = false;
  let result: Promise<Result> | undefined;
  let resolve: (value: Result) => void;
  let reject: (error: TurnRecorderError) => void;

  function pending() {
    if (!result) {
      settled = false;
      result = new Promise<Result>((yes, no) => { resolve = yes; reject = no; });
      // A turn can finish before the caller subscribes through next().
      void result.catch(() => {});
    }
    return result;
  }
  function clearTimer() {
    if (timer !== undefined) clear(timer);
    timer = undefined;
  }
  function fail(error = new TurnRecorderError("failed")) {
    clearTimer();
    active = false;
    stopping = false;
    if (result && !settled) { settled = true; reject(error); }
    if (recorder) {
      recorder.onstart = recorder.onstop = recorder.ondataavailable = recorder.onerror = null;
      if (recorder.state !== "inactive") {
        try { recorder.stop(); } catch { /* Already stopped. */ }
      }
      recorder = undefined;
    }
  }
  function stop(reason: StopReason) {
    if (!active || stopping || !recorder) return;
    stopping = true;
    clearTimer();
    stopReason = reason;
    try { recorder.stop(); } catch { fail(); }
  }
  let stopReason: StopReason = "manual";

  async function begin() {
    if (released) throw new TurnRecorderError("failed");
    if (settled) result = undefined;
    pending();
    if (!devices?.getUserMedia || !Recorder || !Context) {
      throw new TurnRecorderError("unsupported");
    }
    if (!stream) {
      try {
        const acquired = await devices.getUserMedia({ audio: {
          channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true,
        } });
        if (released) {
          acquired.getTracks().forEach((track) => track.stop());
          throw new TurnRecorderError("failed");
        }
        stream = acquired;
      } catch (error) {
        if (error instanceof TurnRecorderError) throw error;
        const name = (error as { name?: string } | null)?.name;
        throw new TurnRecorderError(
          name === "NotAllowedError" || name === "SecurityError" ? "permission"
            : name === "NotFoundError" || name === "OverconstrainedError" ? "no_device" : "failed",
        );
      }
    }
    if (!context) {
      context = new Context();
      source = context.createMediaStreamSource(stream);
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
    }
    if (context.state === "suspended") await context.resume();
    if (released) throw new TurnRecorderError("failed");
    const mimeType = pickMimeType(Recorder);
    const current = new Recorder(stream, { audioBitsPerSecond: 32000, ...(mimeType ? { mimeType } : {}) });
    recorder = current;
    const chunks: Blob[] = [];
    const samples = new Float32Array(analyser!.fftSize);
    let startedAt = 0;
    let lastTick = 0;
    let speechMs = 0;
    let heardSpeech = false;
    let silentSince: number | undefined;
    let floorSum = 0;
    let floorCount = 0;
    let threshold = 0.02;
    stopReason = "manual";
    active = true;
    stopping = false;
    current.ondataavailable = (event) => { chunks.push(event.data); };
    current.onerror = () => fail();
    current.onstop = () => {
      clearTimer();
      active = false;
      stopping = false;
      recorder = undefined;
      settled = true;
      resolve({ recording: {
        blob: new Blob(chunks, { type: current.mimeType }),
        mimeType: current.mimeType,
        durationMs: Math.max(0, now() - startedAt),
      }, reason: stopReason });
    };
    current.onstart = () => {
      startedAt = lastTick = now();
      if (stopping) return;
      timer = every(() => {
        const time = now();
        const elapsed = time - startedAt;
        const delta = Math.max(0, time - lastTick);
        lastTick = time;
        analyser!.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
        options.level?.(rms);
        if (!active || stopping || released) return;
        // Reserve the first 300 ms for room calibration, not speech credit.
        if (elapsed <= 300) {
          floorSum += rms;
          floorCount++;
          threshold = Math.max(0.02, floorSum / floorCount * 2.5);
        } else if (rms > threshold) {
          heardSpeech = true;
          speechMs += delta;
          silentSince = undefined;
        } else {
          silentSince ??= time - delta;
        }
        if (elapsed >= options.maxMs) stop("limit");
        else if (!heardSpeech && elapsed >= (options.noSpeechTimeoutMs ?? 8000)) stop("no_speech");
        else if (speechMs >= (options.minSpeechMs ?? 400) && silentSince !== undefined
          && time - silentSince >= (options.silenceMs ?? 1500)) stop("silence");
      }, 50);
    };
    current.start();
  }

  return {
    start() {
      if (starting) return starting;
      if (active) return Promise.resolve();
      starting = begin().catch((error: unknown) => {
        const mapped = error instanceof TurnRecorderError ? error : new TurnRecorderError("failed");
        fail(mapped);
        throw mapped;
      }).finally(() => { starting = undefined; });
      return starting;
    },
    stop() { stop("manual"); },
    get recording() { return active && !stopping; },
    next() {
      if (released) return Promise.reject(new TurnRecorderError("failed"));
      return pending();
    },
    release() {
      if (released) return;
      released = true;
      fail();
      stream?.getTracks().forEach((track) => track.stop());
      stream = undefined;
      source?.disconnect();
      analyser?.disconnect();
      if (context) void context.close().catch(() => {});
    },
  };
}
