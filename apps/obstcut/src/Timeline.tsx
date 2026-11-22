import type { Project } from "@openreel/core/types";
import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import type { TrackId } from "./model";

const PIXELS_PER_SECOND = 72;

interface TimelineProps {
  readonly project: Project;
  readonly time: number;
  readonly selectedId: string | null;
  readonly onSelect: (clipId: string) => void;
  readonly onSeek: (time: number) => void;
  readonly onMove: (clipId: string, startTime: number) => void;
  readonly onTrim: (clipId: string, edge: "start" | "end", time: number) => void;
}

export function Timeline({ project, time, selectedId, onSelect, onSeek, onMove, onTrim }: TimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const width = Math.max(960, (project.timeline.duration + 8) * PIXELS_PER_SECOND);

  const seekFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scroll = scroller.current?.scrollLeft ?? 0;
    onSeek(Math.max(0, (event.clientX - bounds.left + scroll) / PIXELS_PER_SECOND));
  };

  return (
    <div className="timeline" ref={scroller}>
      <div className="timeline-ruler" style={{ width }}>
        <span className="track-name" />
        <div className="ruler-lane" onPointerDown={seekFromEvent}>
          <div className="playhead" style={{ left: time * PIXELS_PER_SECOND }} />
        </div>
      </div>
      {project.timeline.tracks.map((track) => (
        <div className="track" key={track.id} style={{ width }}>
          <span className="track-name">{track.name}</span>
          <div className="track-lane" onPointerDown={seekFromEvent}>
            {track.clips.map((clip) => {
              const media = project.mediaLibrary.items.find((item) => item.id === clip.mediaId);
              return (
                <button
                  key={clip.id}
                  type="button"
                  className={clip.id === selectedId ? "clip selected" : "clip"}
                  data-start={clip.startTime}
                  data-duration={clip.duration}
                  data-track={track.id}
                  aria-label={`${media?.name ?? track.name} clip`}
                  style={{ left: clip.startTime * PIXELS_PER_SECOND, width: Math.max(28, clip.duration * PIXELS_PER_SECOND) }}
                  onPointerDown={(event) => {
                    if ((event.target as HTMLElement).dataset.trim) return;
                    event.stopPropagation();
                    onSelect(clip.id);
                    const originX = event.clientX;
                    const origin = clip.startTime;
                    const move = (ev: PointerEvent) => {
                      onMove(clip.id, origin + (ev.clientX - originX) / PIXELS_PER_SECOND);
                    };
                    const up = () => {
                      window.removeEventListener("pointermove", move);
                      window.removeEventListener("pointerup", up);
                    };
                    window.addEventListener("pointermove", move);
                    window.addEventListener("pointerup", up);
                  }}
                >
                  <span
                    className="trim"
                    data-trim="start"
                    role="slider"
                    aria-label="Trim start"
                    aria-valuemin={0}
                    aria-valuemax={clip.startTime + clip.duration}
                    aria-valuenow={clip.startTime}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onSelect(clip.id);
                      const originX = event.clientX;
                      const origin = clip.startTime;
                      const move = (ev: PointerEvent) => onTrim(clip.id, "start", origin + (ev.clientX - originX) / PIXELS_PER_SECOND);
                      const up = () => {
                        window.removeEventListener("pointermove", move);
                        window.removeEventListener("pointerup", up);
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                    }}
                  />
                  <span className="clip-name">{media?.name ?? (track.id as TrackId)}</span>
                  <span
                    className="trim end"
                    data-trim="end"
                    role="slider"
                    aria-label="Trim end"
                    aria-valuemin={clip.startTime}
                    aria-valuenow={clip.startTime + clip.duration}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      onSelect(clip.id);
                      const originX = event.clientX;
                      const origin = clip.startTime + clip.duration;
                      const move = (ev: PointerEvent) => onTrim(clip.id, "end", origin + (ev.clientX - originX) / PIXELS_PER_SECOND);
                      const up = () => {
                        window.removeEventListener("pointermove", move);
                        window.removeEventListener("pointerup", up);
                      };
                      window.addEventListener("pointermove", move);
                      window.addEventListener("pointerup", up);
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
