import type { Clip, Project } from "@openreel/core/types";
import { captionsFromWords, setCaptions, type CaptionWordInput } from "./model";

interface WhisperChunk {
  readonly text?: string;
  readonly timestamp?: readonly [number | null, number | null];
}

function resample(buffer: AudioBuffer, sampleRate: number): Float32Array {
  const source = buffer.getChannelData(0);
  const length = Math.max(1, Math.round(buffer.duration * sampleRate));
  const out = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const at = (index / sampleRate) * buffer.sampleRate;
    const left = Math.floor(at);
    const right = Math.min(source.length - 1, left + 1);
    const mix = at - left;
    out[index] = source[left] * (1 - mix) + source[right] * mix;
  }
  return out;
}

function wordsFromChunks(chunks: readonly WhisperChunk[], offset: number): CaptionWordInput[] {
  const words: CaptionWordInput[] = [];
  for (const chunk of chunks) {
    const text = chunk.text?.trim() ?? "";
    const start = chunk.timestamp?.[0];
    const end = chunk.timestamp?.[1];
    if (!text || start == null || end == null || end <= start) continue;
    const tokens = text.split(/\s+/).filter(Boolean);
    const span = end - start;
    let cursor = start;
    tokens.forEach((token, index) => {
      const weight = token.length + 1;
      const total = tokens.reduce((sum, item) => sum + item.length + 1, 0);
      const dur = (weight / total) * span;
      const wordEnd = index === tokens.length - 1 ? end : cursor + dur;
      words.push({ text: token, startTime: offset + cursor, endTime: offset + wordEnd });
      cursor = wordEnd;
    });
  }
  return words;
}

export async function transcribeClip(project: Project, clip: Clip, onStatus: (status: string) => void): Promise<Project> {
  const media = project.mediaLibrary.items.find((item) => item.id === clip.mediaId);
  if (!media?.blob) throw new Error("That clip has no audio to transcribe.");
  onStatus("Reading audio");
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(await media.blob.arrayBuffer());
    const samples = resample(decoded, 16000);
    onStatus("Loading the speech model");
    const worker = new Worker(new URL("./workers/whisper-worker.ts", import.meta.url), { type: "module" });
    const chunks = await new Promise<WhisperChunk[]>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<{ chunks?: WhisperChunk[]; error?: string; status?: string }>) => {
        if (event.data.status) onStatus(event.data.status);
        if (event.data.error) reject(new Error(event.data.error));
        if (event.data.chunks) resolve(event.data.chunks);
      };
      worker.onerror = () => reject(new Error("The speech model failed to load."));
      worker.postMessage({ audio: samples, sampleRate: 16000 }, [samples.buffer]);
    });
    worker.terminate();
    const offset = clip.startTime - clip.inPoint;
    const words = wordsFromChunks(chunks, offset).filter(
      (word) => word.endTime > clip.startTime && word.startTime < clip.startTime + clip.duration,
    );
    if (!words.length) throw new Error("No words were recognized in that clip.");
    onStatus(`Placed ${words.length} words`);
    return setCaptions(project, captionsFromWords(words));
  } finally {
    await audioCtx.close();
  }
}
