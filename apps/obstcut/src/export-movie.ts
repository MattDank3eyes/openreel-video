import { AudioEngine } from "@openreel/core/audio/audio-engine";
import type { Project } from "@openreel/core/types";
import { VideoEngine } from "@openreel/core/video/video-engine";
import { drawWordCaptions } from "./draw-captions";
import { timelineDuration } from "./model";

export interface ExportProgress {
  readonly phase: string;
  readonly ratio: number;
}

async function mixdown(audio: AudioEngine, project: Project, duration: number): Promise<AudioBuffer> {
  const chunk = 4;
  const pieces: AudioBuffer[] = [];
  for (let time = 0; time < duration; time += chunk) {
    const rendered = await audio.renderAudio(project, time, Math.min(chunk, duration - time));
    pieces.push(rendered.buffer);
  }
  const first = pieces[0];
  const length = pieces.reduce((sum, buffer) => sum + buffer.length, 0);
  const mixed = new AudioBuffer({
    length: Math.max(1, length),
    numberOfChannels: first.numberOfChannels,
    sampleRate: first.sampleRate,
  });
  let offset = 0;
  for (const buffer of pieces) {
    for (let channel = 0; channel < mixed.numberOfChannels; channel++) {
      mixed.getChannelData(channel).set(buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1)), offset);
    }
    offset += buffer.length;
  }
  return mixed;
}

export async function exportMovie(project: Project, onProgress: (progress: ExportProgress) => void): Promise<Blob> {
  const duration = timelineDuration(project);
  if (duration <= 0) throw new Error("The timeline is empty.");
  const fps = project.settings.frameRate;
  const width = project.settings.width;
  const height = project.settings.height;
  const frames = Math.max(1, Math.ceil(duration * fps));
  onProgress({ phase: "Preparing export", ratio: 0 });

  const mediabunny = await import("mediabunny");
  const {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    VideoSampleSource,
    VideoSample,
    AudioBufferSource,
    getFirstEncodableVideoCodec,
    getFirstEncodableAudioCodec,
  } = mediabunny;

  const format = new Mp4OutputFormat({ fastStart: "in-memory" });
  const target = new BufferTarget();
  const output = new Output({ format, target });
  const videoCodec = (await getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width, height })) ?? "avc";
  const audioCodec = (await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs())) ?? "aac";
  const videoSource = new VideoSampleSource({ codec: videoCodec, bitrate: 8_000_000 });
  const audioSource = new AudioBufferSource({ codec: audioCodec, bitrate: 160_000 });
  output.addVideoTrack(videoSource);
  output.addAudioTrack(audioSource);
  await output.start();

  const video = new VideoEngine();
  const audio = new AudioEngine();
  await video.initialize();
  await audio.initialize();
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create an export canvas.");

  try {
    for (let index = 0; index < frames; index += 1) {
      const time = index / fps;
      const frame = await video.renderFrame(project, time, width, height);
      ctx.fillStyle = "#120e0b";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(frame.image, 0, 0, width, height);
      frame.image.close();
      drawWordCaptions(ctx, project.timeline.subtitles, time, width, height);
      const bitmap = await createImageBitmap(canvas);
      const sample = new VideoSample(bitmap, { timestamp: time, duration: 1 / fps });
      await videoSource.add(sample);
      sample.close();
      bitmap.close();
      if (index % 5 === 0) onProgress({ phase: "Rendering picture", ratio: (index / frames) * 0.8 });
    }
    onProgress({ phase: "Mixing audio", ratio: 0.85 });
    const mixed = await mixdown(audio, project, duration);
    await audioSource.add(mixed);
    videoSource.close();
    audioSource.close();
    await output.finalize();
  } finally {
    video.dispose();
    await audio.dispose();
  }

  if (!target.buffer) throw new Error("Export produced an empty file.");
  onProgress({ phase: "Done", ratio: 1 });
  return new Blob([target.buffer], { type: "video/mp4" });
}
