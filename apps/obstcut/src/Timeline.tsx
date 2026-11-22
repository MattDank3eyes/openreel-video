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
}

export function Timeline({ project, time, selectedId, onSelect, onSeek, onMove }: TimelineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const width = Math.max(960, (project.timeline.duration + 8) * PIXELS_PER_SECOND);

  const seekFromEvent = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scroll = scroller.current?.scrollLeft ?? 0;
    onSeek(Math.max(0, (event.clientX - bounds.left + scroll) / PIXELS_PER_SECOND));
  };

  return (
    <div className="timeline" ref={scroller}>
      <div className="timeline-ruler" style={{ width }} onPointerDown={seekFromEvent}>
        <div className="playhead" style={{ left: time * PIXELS_PER_SECOND }} />
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
                  style={{ left: clip.startTime * PIXELS_PER_SECOND, width: Math.max(12, clip.duration * PIXELS_PER_SECOND) }}
                  onPointerDown={(event) => {
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
                  {media?.name ?? (track.id as TrackId)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
