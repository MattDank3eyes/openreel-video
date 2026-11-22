import { AudioEngine } from "@openreel/core/audio/audio-engine";
import type { Project } from "@openreel/core/types";
import { VideoEngine } from "@openreel/core/video/video-engine";
import { drawWordCaptions } from "./draw-captions";
import { timelineDuration } from "./model";

export class PreviewPlayer {
  private readonly video = new VideoEngine();
  private readonly audio = new AudioEngine();
  private playToken = 0;

  async draw(project: Project, time: number, canvas: HTMLCanvasElement): Promise<void> {
    await this.video.initialize();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const width = project.settings.width;
    const height = project.settings.height;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    ctx.fillStyle = "#120e0b";
    ctx.fillRect(0, 0, width, height);
    if (timelineDuration(project) <= 0) return;
    const frame = await this.video.renderFrame(project, time, width, height);
    ctx.drawImage(frame.image, 0, 0, width, height);
    frame.image.close();
    drawWordCaptions(ctx, project.timeline.subtitles, time, width, height);
  }

  stop(): void {
    this.playToken += 1;
  }

  async play(
    project: Project,
    from: number,
    canvas: HTMLCanvasElement,
    onTime: (time: number) => void,
  ): Promise<void> {
    this.stop();
    const token = this.playToken;
    await this.video.initialize();
    await this.audio.initialize();
    const ctx = this.audio.getAudioContext();
    if (ctx.state === "suspended") await ctx.resume();
    const end = timelineDuration(project);
    const origin = Math.min(Math.max(0, from), end);
    const startAt = ctx.currentTime + 0.08;
    let cursor = origin;
    while (cursor < end - 0.01 && token === this.playToken) {
      const length = Math.min(2, end - cursor);
      const rendered = await this.audio.renderAudio(project, cursor, length, { preview: true });
      if (token !== this.playToken) return;
      const source = ctx.createBufferSource();
      source.buffer = rendered.buffer;
      source.connect(ctx.destination);
      source.start(startAt + (cursor - origin));
      cursor += length;
    }
    const started = performance.now();
    const tick = () => {
      if (token !== this.playToken) return;
      const time = Math.min(end, origin + (performance.now() - started) / 1000);
      onTime(time);
      void this.draw(project, time, canvas);
      if (time < end) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async dispose(): Promise<void> {
    this.stop();
    this.video.dispose();
    await this.audio.dispose();
  }
}
