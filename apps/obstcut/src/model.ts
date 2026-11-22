import type { AudioType, Clip, Effect, MediaItem, Project, Subtitle, SubtitleWord, Track } from "@openreel/core/types";

export type TrackId = "video" | "dialogue" | "music";

export interface ImportedMedia {
  readonly file: File;
  readonly duration: number;
  readonly width: number;
  readonly height: number;
  readonly kind: "video" | "audio";
}

const IDENTITY = {
  position: { x: 0, y: 0 },
  scale: { x: 1, y: 1 },
  rotation: 0,
  anchor: { x: 0.5, y: 0.5 },
  opacity: 1,
  fitMode: "contain" as const,
};

let seq = 0;
export function nid(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function resetIds(): void {
  seq = 0;
}

function trackDef(id: TrackId): { name: string; type: Track["type"]; role: Track["role"]; audioType: AudioType | null } {
  if (id === "video") return { name: "Video", type: "video", role: "general", audioType: "dialogue" };
  if (id === "dialogue") return { name: "Dialogue", type: "audio", role: "dialogue", audioType: "dialogue" };
  return { name: "Music", type: "audio", role: "music", audioType: "music" };
}

function emptyTrack(id: TrackId): Track {
  const def = trackDef(id);
  return {
    id,
    name: def.name,
    type: def.type,
    role: def.role,
    clips: [],
    transitions: [],
    locked: false,
    hidden: false,
    muted: false,
    solo: false,
  };
}

export function createProject(name = "Untitled"): Project {
  const now = Date.now();
  return {
    id: nid("project"),
    name,
    createdAt: now,
    modifiedAt: now,
    settings: { width: 1280, height: 720, frameRate: 30, sampleRate: 48000, channels: 2 },
    mediaLibrary: { items: [] },
    timeline: {
      tracks: [emptyTrack("video"), emptyTrack("dialogue"), emptyTrack("music")],
      subtitles: [],
      duration: 0,
      markers: [],
    },
  };
}

export function timelineDuration(project: Project): number {
  let end = 0;
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) end = Math.max(end, clip.startTime + clip.duration);
  }
  for (const cue of project.timeline.subtitles) end = Math.max(end, cue.endTime);
  return end;
}

function touch(project: Project, timeline: Project["timeline"]): Project {
  return { ...project, modifiedAt: Date.now(), timeline: { ...timeline, duration: 0 } };
}

function withDuration(project: Project): Project {
  return { ...project, timeline: { ...project.timeline, duration: timelineDuration(project) } };
}

function mapClips(project: Project, fn: (clip: Clip, track: Track) => Clip): Project {
  const timeline = {
    ...project.timeline,
    tracks: project.timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => fn(clip, track)),
    })),
  };
  return withDuration(touch({ ...project, timeline }, timeline));
}

export function addMediaClip(project: Project, media: ImportedMedia, trackId: TrackId): Project {
  const def = trackDef(trackId);
  const mediaId = nid("media");
  const item: MediaItem = {
    id: mediaId,
    name: media.file.name,
    type: media.kind === "video" ? "video" : "audio",
    fileHandle: null,
    blob: media.file,
    metadata: {
      duration: media.duration,
      width: media.width,
      height: media.height,
      frameRate: project.settings.frameRate,
      codec: media.kind,
      sampleRate: project.settings.sampleRate,
      channels: project.settings.channels,
      fileSize: media.file.size,
      hasVideo: media.kind === "video",
      hasAudio: true,
    },
    thumbnailUrl: null,
    waveformData: null,
  };
  const start = timelineDuration(project);
  const clip: Clip = {
    id: nid("clip"),
    mediaId,
    trackId,
    startTime: start,
    duration: media.duration,
    inPoint: 0,
    outPoint: media.duration,
    effects: [],
    audioEffects: [],
    transform: IDENTITY,
    volume: 1,
    keyframes: [],
    ...(def.audioType ? { audioType: def.audioType } : {}),
  };
  const timeline = {
    ...project.timeline,
    tracks: project.timeline.tracks.map((track) =>
      track.id === trackId ? { ...track, clips: [...track.clips, clip] } : track,
    ),
  };
  return withDuration(touch({ ...project, mediaLibrary: { items: [...project.mediaLibrary.items, item] }, timeline }, timeline));
}

export function moveClip(project: Project, clipId: string, startTime: number): Project {
  const next = Math.max(0, startTime);
  return mapClips(project, (clip) => (clip.id === clipId ? { ...clip, startTime: next } : clip));
}

export function trimClip(project: Project, clipId: string, edge: "start" | "end", time: number): Project {
  return mapClips(project, (clip) => {
    if (clip.id !== clipId) return clip;
    const media = project.mediaLibrary.items.find((item) => item.id === clip.mediaId);
    const max = media?.metadata.duration ?? clip.outPoint;
    if (edge === "start") {
      const end = clip.startTime + clip.duration;
      const start = Math.min(Math.max(0, time), end - 0.1);
      const delta = start - clip.startTime;
      return { ...clip, startTime: start, inPoint: Math.min(max - 0.1, Math.max(0, clip.inPoint + delta)), duration: end - start, outPoint: Math.min(max, clip.inPoint + delta + (end - start)) };
    }
    const end = Math.max(clip.startTime + 0.1, time);
    const duration = end - clip.startTime;
    return { ...clip, duration, outPoint: Math.min(max, clip.inPoint + duration) };
  });
}

export function splitClip(project: Project, clipId: string, time: number): Project {
  let created = false;
  const tracks = project.timeline.tracks.map((track) => {
    const clips: Clip[] = [];
    for (const clip of track.clips) {
      const end = clip.startTime + clip.duration;
      if (clip.id !== clipId || time <= clip.startTime + 0.05 || time >= end - 0.05) {
        clips.push(clip);
        continue;
      }
      created = true;
      const leftDur = time - clip.startTime;
      const rightDur = end - time;
      clips.push({ ...clip, duration: leftDur, outPoint: clip.inPoint + leftDur });
      clips.push({
        ...clip,
        id: nid("clip"),
        startTime: time,
        duration: rightDur,
        inPoint: clip.inPoint + leftDur,
        outPoint: clip.inPoint + leftDur + rightDur,
        audioEffects: clip.audioEffects.map((effect) => ({ ...effect, id: nid("fx") })),
      });
    }
    return { ...track, clips };
  });
  if (!created) return project;
  const timeline = { ...project.timeline, tracks };
  return withDuration(touch({ ...project, timeline }, timeline));
}

export function deleteClip(project: Project, clipId: string): Project {
  const tracks = project.timeline.tracks.map((track) => ({
    ...track,
    clips: track.clips.filter((clip) => clip.id !== clipId),
  }));
  const timeline = { ...project.timeline, tracks };
  return withDuration(touch({ ...project, timeline }, timeline));
}

const NOISE: Omit<Effect, "id"> = {
  type: "noiseReduction",
  enabled: true,
  params: { threshold: -40, reduction: 0.55, attack: 10, release: 120, focus: "speech" },
};

export function clipHasNoiseRemoval(clip: Clip): boolean {
  return clip.audioEffects.some((effect) => effect.type === "noiseReduction" && effect.enabled);
}

export function setNoiseRemoval(project: Project, clipId: string, enabled: boolean): Project {
  return mapClips(project, (clip) => {
    if (clip.id !== clipId || clip.audioType === "music") return clip;
    const rest = clip.audioEffects.filter((effect) => effect.type !== "noiseReduction");
    return { ...clip, audioEffects: enabled ? [...rest, { ...NOISE, id: nid("fx") }] : rest };
  });
}

export interface DuckSettings {
  readonly enabled: boolean;
  readonly amountDb: number;
}

export function setAutoDuck(project: Project, enabled: boolean, amountDb = 12): Project {
  const amount = Math.min(40, Math.max(1, amountDb));
  return mapClips(project, (clip) => {
    if (clip.audioType !== "music") return clip;
    const metadata = { ...(clip.metadata ?? {}) };
    if (!enabled) {
      delete metadata.liveDucking;
      return { ...clip, metadata };
    }
    return {
      ...clip,
      metadata: {
        ...metadata,
        liveDucking: { enabled: true, amountDb: amount, attackMs: 180, releaseMs: 280, holdMs: 120 },
      },
    };
  });
}

export function duckSettings(project: Project): DuckSettings {
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      const duck = clip.metadata?.liveDucking;
      if (duck?.enabled) return { enabled: true, amountDb: duck.amountDb };
    }
  }
  return { enabled: false, amountDb: 12 };
}

export interface CaptionWordInput {
  readonly text: string;
  readonly startTime: number;
  readonly endTime: number;
}

/** Group timed words into cues that step one word at a time. */
export function captionsFromWords(words: readonly CaptionWordInput[]): Subtitle[] {
  const cues: Subtitle[] = [];
  let bucket: SubtitleWord[] = [];
  const flush = () => {
    if (!bucket.length) return;
    const text = bucket.map((word) => word.text).join(" ");
    cues.push({
      id: nid("cue"),
      text,
      startTime: bucket[0].startTime,
      endTime: bucket[bucket.length - 1].endTime,
      words: bucket,
      animationStyle: "word-by-word",
      hidden: true,
      style: {
        fontFamily: "sans-serif",
        fontSize: 64,
        color: "#fff8ea",
        backgroundColor: "rgba(20, 14, 8, 0.72)",
        position: "bottom",
        highlightColor: "#e7a34b",
      },
    });
    bucket = [];
  };
  for (const word of words) {
    const text = word.text.trim();
    if (!text) continue;
    const start = word.startTime;
    const end = Math.max(start + 0.04, word.endTime);
    const prev = bucket[bucket.length - 1];
    if (bucket.length >= 8 || (prev && start - prev.endTime > 0.7)) flush();
    bucket.push({ text, startTime: start, endTime: end });
  }
  flush();
  return cues;
}

export function setCaptions(project: Project, subtitles: readonly Subtitle[]): Project {
  const timeline = { ...project.timeline, subtitles: [...subtitles] };
  return withDuration(touch({ ...project, timeline }, timeline));
}

export function findClip(project: Project, clipId: string): { clip: Clip; track: Track } | null {
  for (const track of project.timeline.tracks) {
    const clip = track.clips.find((item) => item.id === clipId);
    if (clip) return { clip, track };
  }
  return null;
}
