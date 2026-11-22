import { useEffect, useRef, useState } from "react";
import { PRODUCT_NAME } from "./brand";
import { exportMovie } from "./export-movie";
import { PreviewPlayer } from "./playback";
import { Timeline } from "./Timeline";
import { transcribeClip } from "./transcribe";
import {
  addMediaClip,
  clipHasNoiseRemoval,
  createProject,
  deleteClip,
  duckSettings,
  findClip,
  moveClip,
  setAutoDuck,
  setNoiseRemoval,
  splitClip,
  timelineDuration,
  type ImportedMedia,
  type TrackId,
} from "./model";

function formatTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function probeFile(file: File): Promise<ImportedMedia> {
  const url = URL.createObjectURL(file);
  const kind = file.type.startsWith("audio/") ? "audio" : "video";
  try {
    const el = document.createElement(kind === "audio" ? "audio" : "video");
    el.preload = "metadata";
    const duration = await new Promise<number>((resolve, reject) => {
      el.onloadedmetadata = () => resolve(Number.isFinite(el.duration) ? el.duration : 0);
      el.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      el.src = url;
    });
    const video = el instanceof HTMLVideoElement ? el : null;
    return {
      file,
      duration,
      width: video?.videoWidth || (kind === "video" ? 1920 : 0),
      height: video?.videoHeight || (kind === "video" ? 1080 : 0),
      kind,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function App() {
  const [project, setProject] = useState(() => createProject(PRODUCT_NAME));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importTrack, setImportTrack] = useState<TrackId>("video");
  const [status, setStatus] = useState("Import a clip to start.");
  const [about, setAbout] = useState(false);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PreviewPlayer | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = selectedId ? findClip(project, selectedId) : null;
  const duck = duckSettings(project);
  const duration = timelineDuration(project);

  if (!playerRef.current) playerRef.current = new PreviewPlayer();

  useEffect(() => {
    const canvas = canvasRef.current;
    const player = playerRef.current;
    if (!canvas || !player || playing) return;
    void player.draw(project, time, canvas);
  }, [project, time, playing]);

  useEffect(() => () => {
    void playerRef.current?.dispose();
  }, []);

  const stop = () => {
    playerRef.current?.stop();
    setPlaying(false);
  };

  const play = async () => {
    const canvas = canvasRef.current;
    const player = playerRef.current;
    if (!canvas || !player || duration <= 0) return;
    setPlaying(true);
    setStatus("Playing");
    const from = time >= duration - 0.05 ? 0 : time;
    try {
      await player.play(project, from, canvas, setTime);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Playback failed.");
    } finally {
      setPlaying(false);
    }
  };

  const importFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      let next = project;
      for (const file of Array.from(list)) {
        const media = await probeFile(file);
        if (media.duration <= 0) throw new Error(`${file.name} has no duration.`);
        next = addMediaClip(next, media, importTrack);
      }
      setProject(next);
      setStatus(`Added ${list.length} file${list.length === 1 ? "" : "s"} to ${importTrack}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const transcribe = async () => {
    if (!selected) {
      setStatus("Select a clip to caption.");
      return;
    }
    setBusy(true);
    try {
      const next = await transcribeClip(project, selected.clip, setStatus);
      setProject(next);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Transcription failed.");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    setBusy(true);
    stop();
    try {
      const blob = await exportMovie(project, (progress) => {
        setStatus(`${progress.phase} ${Math.round(progress.ratio * 100)}%`);
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.replace(/[^\w.-]+/g, "-") || "obstcut"}.mp4`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus("Export downloaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">{PRODUCT_NAME}</span>
        <select aria-label="Import onto" value={importTrack} onChange={(event) => setImportTrack(event.target.value as TrackId)}>
          <option value="video">Video</option>
          <option value="dialogue">Dialogue</option>
          <option value="music">Music</option>
        </select>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Import</button>
        <input ref={fileRef} type="file" accept="video/*,audio/*" multiple hidden onChange={(event) => void importFiles(event.target.files)} />
        <button type="button" className="primary" onClick={() => (playing ? stop() : void play())} disabled={duration <= 0 || busy}>
          {playing ? "Stop" : "Play"}
        </button>
        <span className="time">{formatTime(time)} / {formatTime(duration)}</span>
        <button type="button" onClick={() => void download()} disabled={duration <= 0 || busy}>Export</button>
        <button type="button" onClick={() => setAbout(true)}>About</button>
      </header>
      <main className="stage">
        <div className="preview-wrap">
          <canvas ref={canvasRef} aria-label="Preview" />
        </div>
        <aside className="inspector">
          <h2>{selected ? selected.track.name : "Clip"}</h2>
          {selected ? (
            <>
              <p>{project.mediaLibrary.items.find((item) => item.id === selected.clip.mediaId)?.name}</p>
              <label>
                Noise removal
                <input
                  type="checkbox"
                  checked={clipHasNoiseRemoval(selected.clip)}
                  disabled={selected.clip.audioType === "music"}
                  onChange={(event) => setProject(setNoiseRemoval(project, selected.clip.id, event.target.checked))}
                />
              </label>
              <button type="button" onClick={() => void transcribe()} disabled={busy}>Word-by-word captions</button>
              <button type="button" onClick={() => { setProject(splitClip(project, selected.clip.id, time)); }}>Split at playhead</button>
              <button type="button" onClick={() => { setProject(deleteClip(project, selected.clip.id)); setSelectedId(null); }}>Delete clip</button>
            </>
          ) : (
            <p>Select a clip on the timeline. Video and dialogue duck the music bed. Captions highlight one word at a time.</p>
          )}
          <label>
            Auto-duck music
            <input
              type="checkbox"
              checked={duck.enabled}
              onChange={(event) => setProject(setAutoDuck(project, event.target.checked, duck.amountDb))}
            />
          </label>
          <label>
            Duck amount
            <input
              aria-label="Duck amount"
              type="range"
              min={1}
              max={24}
              value={duck.amountDb}
              onChange={(event) => setProject(setAutoDuck(project, true, Number(event.target.value)))}
            />
          </label>
        </aside>
      </main>
      <Timeline
        project={project}
        time={time}
        selectedId={selectedId}
        onSelect={(clipId) => { stop(); setSelectedId(clipId); }}
        onSeek={(next) => { stop(); setTime(next); }}
        onMove={(clipId, start) => setProject(moveClip(project, clipId, start))}
      />
      <footer className="statusbar">{status}</footer>
      {about && (
        <div className="dialog-back" onClick={() => setAbout(false)}>
          <div className="dialog" role="dialog" aria-labelledby="about-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="about-title">About {PRODUCT_NAME}</h2>
            <p>Timeline, word-by-word captions, noise removal, auto-ducking, and export.</p>
            <button type="button" onClick={() => setAbout(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
