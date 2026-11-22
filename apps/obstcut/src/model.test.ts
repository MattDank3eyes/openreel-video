import { describe, expect, it, beforeEach } from "vitest";
import { applyLiveDuckingToLane } from "@openreel/core/audio/live-ducking";
import { renderAnimatedCaption } from "@openreel/core/text/caption-animation-renderer";
import {
  addMediaClip,
  captionsFromWords,
  clipHasNoiseRemoval,
  createProject,
  deleteClip,
  duckSettings,
  moveClip,
  resetIds,
  trimClip,
  setAutoDuck,
  setCaptions,
  setNoiseRemoval,
  splitClip,
  timelineDuration,
} from "./model";

const file = new File([new Uint8Array([1, 2, 3])], "talk.mp4", { type: "video/mp4" });
const music = new File([new Uint8Array([1])], "bed.wav", { type: "audio/wav" });

beforeEach(() => resetIds());

describe("timeline", () => {
  it("starts with video, dialogue, and music tracks", () => {
    const project = createProject("Spot");
    expect(project.name).toBe("Spot");
    expect(project.timeline.tracks.map((track) => track.id)).toEqual(["video", "dialogue", "music"]);
    expect(timelineDuration(project)).toBe(0);
  });

  it("places a clip and can move, split, and delete it", () => {
    let project = addMediaClip(createProject(), { file, duration: 10, width: 1280, height: 720, kind: "video" }, "video");
    const clip = project.timeline.tracks[0].clips[0];
    expect(clip.duration).toBe(10);
    expect(timelineDuration(project)).toBe(10);
    project = moveClip(project, clip.id, 2);
    expect(project.timeline.tracks[0].clips[0].startTime).toBe(2);
    project = splitClip(project, clip.id, 6);
    expect(project.timeline.tracks[0].clips).toHaveLength(2);
    expect(project.timeline.tracks[0].clips[1].startTime).toBe(6);
    project = deleteClip(project, clip.id);
    expect(project.timeline.tracks[0].clips).toHaveLength(1);
  });

  it("trims the start and the end", () => {
    let project = addMediaClip(createProject(), { file, duration: 10, width: 1280, height: 720, kind: "video" }, "video");
    const clip = project.timeline.tracks[0].clips[0];
    project = trimClip(project, clip.id, "start", 1);
    project = trimClip(project, clip.id, "end", 8);
    const trimmed = project.timeline.tracks[0].clips[0];
    expect(trimmed.startTime).toBeCloseTo(1, 2);
    expect(trimmed.startTime + trimmed.duration).toBeCloseTo(8, 2);
    expect(trimmed.inPoint).toBeCloseTo(1, 2);
  });
});

describe("noise removal and auto-duck", () => {
  it("adds a noise-reduction effect on dialogue and ducks music under it", () => {
    let project = addMediaClip(createProject(), { file, duration: 8, width: 100, height: 100, kind: "video" }, "video");
    project = addMediaClip(project, { file: music, duration: 8, width: 0, height: 0, kind: "audio" }, "music");
    const speech = project.timeline.tracks[0].clips[0];
    const bed = project.timeline.tracks[2].clips[0];
    project = moveClip(project, bed.id, 0);
    project = setNoiseRemoval(project, speech.id, true);
    project = setAutoDuck(project, true, 14);
    const spoken = project.timeline.tracks[0].clips[0];
    const ducked = project.timeline.tracks[2].clips[0];
    expect(clipHasNoiseRemoval(spoken)).toBe(true);
    expect(duckSettings(project)).toEqual({ enabled: true, amountDb: 14 });
    const lane = applyLiveDuckingToLane(ducked, project.timeline, []);
    expect(lane.some((point) => point.value < ducked.volume)).toBe(true);
    project = setNoiseRemoval(project, speech.id, false);
    project = setAutoDuck(project, false);
    expect(clipHasNoiseRemoval(project.timeline.tracks[0].clips[0])).toBe(false);
    expect(duckSettings(project).enabled).toBe(false);
  });
});

describe("word-by-word captions", () => {
  it("builds cues the caption renderer steps through one word at a time", () => {
    const cues = captionsFromWords([
      { text: "Hello", startTime: 0.1, endTime: 0.4 },
      { text: "there", startTime: 0.4, endTime: 0.8 },
    ]);
    expect(cues).toHaveLength(1);
    expect(cues[0].animationStyle).toBe("word-by-word");
    expect(cues[0].hidden).toBe(true);
    const mid = renderAnimatedCaption(cues[0], 0.5);
    expect(mid.visible).toBe(true);
    expect(mid.segments.map((segment) => segment.text)).toEqual(["there"]);
    const project = setCaptions(createProject(), cues);
    expect(project.timeline.subtitles[0].words).toHaveLength(2);
  });
});
