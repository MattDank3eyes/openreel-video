/// <reference lib="webworker" />

interface WhisperChunk {
  text?: string;
  timestamp?: [number | null, number | null];
}

self.onmessage = (event: MessageEvent<{ audio: Float32Array; sampleRate: number }>) => {
  const { audio } = event.data;
  void (async () => {
    try {
      const { env, pipeline } = await import("@huggingface/transformers");
      const modelBase = new URL("../models/", self.location.href);
      env.allowLocalModels = false;
      env.allowRemoteModels = true;
      env.remoteHost = modelBase.href;
      env.remotePathTemplate = "{model}/";
      self.postMessage({ status: "Loading the speech model" });
      const transcriber = await pipeline("automatic-speech-recognition", "onnx-community/whisper-tiny", {
        dtype: "q4",
      });
      self.postMessage({ status: "Transcribing" });
      const result = (await transcriber(audio, { return_timestamps: true })) as
        | { chunks?: WhisperChunk[] }
        | Array<{ chunks?: WhisperChunk[] }>;
      const chunks = Array.isArray(result) ? result.flatMap((item) => item.chunks ?? []) : (result.chunks ?? []);
      self.postMessage({ chunks, status: "Words ready" });
    } catch (error) {
      self.postMessage({ error: error instanceof Error ? error.message : "Transcription failed." });
    }
  })();
};
