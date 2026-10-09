"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { finishPatientAction, playPatientCough, stopPatientPlayback, usePatientPlayback, type PatientPlayback } from "./patient-playback";
import "./patient-media.css";

type Phase = "talk-start" | "talk-loop" | "talk-end" | "cough";
const phases: Phase[] = ["talk-start", "talk-loop", "talk-end", "cough"];

// All clips are preloaded; the poster stays underneath until the next clip plays.
// Transitions follow real audio events, rather than the length of the reply text.
export default function PatientMedia({ alt }: { alt: string }) {
  const playback = usePatientPlayback();
  const media = useRef<Record<string, HTMLVideoElement | null>>({});
  const action = useRef<{ phase: Phase | null; id: number }>({ phase: null, id: 0 });
  const current = useRef<PatientPlayback>(playback);
  const reduced = useRef(false);
  const [visible, setVisible] = useState<Phase | null>(null);
  useEffect(() => {
    const videos = media.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reduced.current = preference.matches;
      if (preference.matches) { Object.values(media.current).forEach(video => video?.pause()); setVisible(null); }
    };
    update(); preference.addEventListener("change", update);
    return () => { preference.removeEventListener("change", update); Object.values(videos).forEach(video => video?.pause()); };
  }, []);
  useEffect(() => {
    current.current = playback;
    const run = (phase: Phase) => {
      action.current = { phase, id: playback.playbackId };
      const video = media.current[phase];
      if (!video || reduced.current) return;
      video.currentTime = 0;
      void video.play().catch(() => setVisible(null));
    };
    // Stop old clips before a different answer/cough; asynchronous play events
    // are checked against the current action below.
    if (playback.playbackId !== action.current.id || playback.loading) {
      Object.values(media.current).forEach(video => video?.pause());
    }
    if (playback.kind === "cough") run("cough");
    else if (playback.speaking) run("talk-start");
    else if (playback.kind === "idle" && visible && visible !== "cough") run("talk-end");
    else {
      action.current = { phase: null, id: playback.playbackId };
      // Defer the display reset to the video lifecycle/next browser frame.
      const frame = requestAnimationFrame(() => setVisible(null));
      return () => cancelAnimationFrame(frame);
    }
  // visible is the displayed frame, not a playback trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playbackId, playback.kind, playback.speaking, playback.loading]);
  const ended = (phase: Phase) => {
    if (action.current.phase !== phase) return;
    if (phase === "talk-start" && current.current.speaking && !reduced.current) {
      action.current.phase = "talk-loop";
      const loop = media.current["talk-loop"];
      if (loop) { loop.currentTime = 0; void loop.play().catch(() => setVisible(null)); }
    } else if (phase === "cough") { setVisible(null); finishPatientAction(action.current.id); }
    else { setVisible(null); action.current.phase = null; }
  };
  return <div className="patient-media" data-phase={visible ?? "idle"}>
    <img src="/assets/patient-guoman.png" alt={alt} width={1448} height={1086} />
    {phases.map(phase => <video key={phase} ref={video => { media.current[phase] = video; }} src={`/assets/patient-video/${phase}.mp4`} muted playsInline preload="auto" loop={phase === "talk-loop"} aria-hidden="true" className={visible === phase ? "visible" : ""} onPlaying={() => {
      if (action.current.phase !== phase || reduced.current) { media.current[phase]?.pause(); return; }
      Object.entries(media.current).forEach(([key, video]) => { if (key !== phase) video?.pause(); });
      setVisible(phase);
    }} onEnded={() => ended(phase)} onError={() => { if (action.current.phase === phase) { setVisible(null); if (phase === "cough") finishPatientAction(action.current.id); } }} />)}
  </div>;
}

export function PatientMediaTools() {
  const playback = usePatientPlayback();
  return <div className="patient-media-tools">
    <button type="button" onClick={playPatientCough} disabled={playback.speaking || playback.loading || playback.kind === "cough"}>演示咳嗽</button>
    <button type="button" onClick={stopPatientPlayback} disabled={playback.kind === "idle"}>停止播放</button>
    {playback.error && <span role="status">{playback.error}</span>}
  </div>;
}
