"use client";

import { useSyncExternalStore } from "react";
import audioManifest from "./patient-audio-manifest.json";

export type PatientPlayback = { speaking: boolean; loading: boolean; playbackId: number; kind: "speech" | "cough" | "idle"; error: string };
const idle: PatientPlayback = { speaking: false, loading: false, playbackId: 0, kind: "idle", error: "" };
let state = idle;
let sequence = 0;
let cleanup: (() => void) | undefined;
let completion: (() => void) | undefined;
const listeners = new Set<() => void>();
const publish = (value: PatientPlayback) => { state = value; listeners.forEach(listener => listener()); };
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function usePatientPlayback() { return useSyncExternalStore(subscribe, () => state, () => idle); }

export function stopPatientPlayback() {
  ++sequence;
  cleanup?.(); cleanup = undefined;
  const done = completion; completion = undefined;
  publish({ ...idle, playbackId: sequence });
  done?.();
}

export function finishPatientAction(id: number) {
  if (id !== sequence) return;
  cleanup?.(); cleanup = undefined;
  const done = completion; completion = undefined;
  publish({ ...idle, playbackId: id });
  done?.();
}

export function playPatientCough() {
  stopPatientPlayback();
  const id = ++sequence;
  publish({ ...idle, playbackId: id, kind: "cough" });
  // Safety fallback for reduced motion, missing files or background tabs.
  const timer = window.setTimeout(() => finishPatientAction(id), 3000);
  cleanup = () => window.clearTimeout(timer);
}

export function speakPatientText(text: string, onEnd?: () => void, onStart?: () => void) {
  if (typeof window === "undefined") return false;
  stopPatientPlayback();
  const id = ++sequence;
  completion = onEnd;
  publish({ ...idle, playbackId: id, kind: "speech", loading: true });
  const finish = (error = "") => {
    if (id !== sequence) return;
    finishPatientAction(id);
    if (error) publish({ ...state, error });
  };
  const start = () => {
    if (id !== sequence) return;
    publish({ ...idle, playbackId: id, kind: "speech", speaking: true });
    onStart?.();
  };
  let usingBrowser = false;
  const browserVoice = () => {
    if (id !== sequence || usingBrowser) return;
    usingBrowser = true;
    cleanup?.(); cleanup = undefined;
    if (!window.speechSynthesis) { finish("此设备无法播放语音，请阅读患者回答。"); return; }
    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN"; utterance.rate = 0.88; utterance.pitch = 1;
    utterance.onstart = start;
    utterance.onend = () => finish();
    utterance.onerror = () => finish("语音未能播放，可重听或阅读文字回答。");
    let queued = false;
    const queue = () => {
      if (id !== sequence || queued) return;
      queued = true;
      const voices = synth.getVoices();
      utterance.voice = voices.find(voice => /^(zh|cmn)/i.test(voice.lang) && /xiaoxiao|xiaoyi|huihui|tingting|meijia|lili|yating|female|女/i.test(voice.name)) ?? voices.find(voice => /^(zh|cmn)/i.test(voice.lang)) ?? null;
      synth.speak(utterance);
    };
    const timer = window.setTimeout(queue, 700);
    synth.addEventListener("voiceschanged", queue);
    cleanup = () => {
      window.clearTimeout(timer); synth.removeEventListener("voiceschanged", queue);
      utterance.onstart = null; utterance.onend = null; utterance.onerror = null;
      synth.cancel();
    };
    if (synth.getVoices().length) queue();
  };
  const recorded = (audioManifest as Array<{ text: string; src: string }>).find(item => item.text === text);
  if (!recorded) browserVoice();
  else {
    const audio = new Audio(recorded.src);
    audio.preload = "auto";
    audio.onplaying = start;
    audio.onended = () => finish();
    audio.onerror = browserVoice;
    const timeout = window.setTimeout(browserVoice, 12000);
    cleanup = () => {
      window.clearTimeout(timeout); audio.onplaying = null; audio.onended = null; audio.onerror = null;
      audio.pause(); audio.removeAttribute("src"); audio.load();
    };
    audio.addEventListener("playing", () => window.clearTimeout(timeout), { once: true });
    void audio.play().catch(browserVoice);
  }
  return true;
}
