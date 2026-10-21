"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import {
  defaultPatientMedia,
  patientVoices,
  type PatientMedia,
} from "./teacher-patient-media";

export function PatientAvatar({
  media,
  name,
  decorative = false,
}: {
  media: PatientMedia;
  name: string;
  decorative?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState("");
  const illustration = media.avatarKind === "illustration",
    src = media.avatarSrc;
  const older = Number(media.avatarAge) >= 55,
    female = media.avatarGender === "女";
  const hair = older ? "#89939e" : "#3e4e61",
    blue = media.avatarVariant % 2 ? "#c8dbf5" : "#c4d4e8";
  return (
    <span
      className={`t-patient-avatar${media.avatarKind === "existing" ? " t-patient-photo-existing" : ""}`}
      aria-hidden={decorative || undefined}
    >
      {src && failedSrc !== src ? (
        <img
          src={src}
          alt={decorative ? "" : `${name || "患者"}形象`}
          onError={() => setFailedSrc(src)}
        />
      ) : illustration ? (
        <svg
          viewBox="0 0 160 160"
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : "患者示意形象"}
        >
          <rect width="160" height="160" fill="#eef4fb" />
          <circle cx="80" cy="74" r="60" fill="#e0eaf6" />
          <path d="M23 160c3-38 24-54 57-54s54 16 57 54" fill={blue} />
          <path
            d={
              female
                ? "M45 97V62c-1-38 71-44 72 2v33z"
                : "M46 72V59c0-44 68-40 68 0v20z"
            }
            fill={hair}
          />
          <path d="M69 100h22v22c-8 10-15 10-22 0z" fill="#e9bea3" />
          <ellipse cx="80" cy="71" rx="30" ry="37" fill="#f2cfb4" />
          <path
            d={
              female
                ? "M49 67c0-31 17-41 33-41 23 0 34 18 32 44-9-6-19-17-24-27-7 12-23 20-41 24z"
                : "M49 60c1-27 17-35 32-35 19 0 33 10 32 38-10-9-18-13-26-21-10 11-24 15-38 18z"
            }
            fill={hair}
          />
          <path
            d="M61 72h7m24 0h7"
            stroke="#5f514b"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M80 77v9m-8 8c5 3 11 3 16 0"
            fill="none"
            stroke="#bd8d74"
            strokeWidth="1.7"
            strokeLinecap="round"
          />
          {older && (
            <path d="M57 79l8 2m30 0 8-2" stroke="#d4a78a" strokeWidth="1.2" />
          )}
          <path
            d="m68 116 12 16 12-16M80 132v28"
            fill="none"
            stroke="#f7fbff"
            strokeWidth="3"
          />
        </svg>
      ) : (
        <span
          className="t-patient-initial"
          role={decorative ? undefined : "img"}
          aria-label={decorative ? undefined : "未设置患者形象"}
        >
          {name.trim().slice(0, 1) || "患"}
        </span>
      )}
    </span>
  );
}

export function PatientMediaEditor({
  media,
  name,
  gender,
  age,
  change,
  busy,
  setBusy,
  error,
}: {
  media: PatientMedia;
  name: string;
  gender: string;
  age: string;
  change: (media: PatientMedia) => void;
  busy: boolean;
  setBusy: (value: boolean) => void;
  error: (value: string) => void;
}) {
  const audio = useRef<HTMLAudioElement>(null),
    operation = useRef({ sequence: 0 });
  const playbackToken = useRef({ sequence: 0 });
  const [playing, setPlaying] = useState(false);
  const stop = () => {
    playbackToken.current.sequence++;
    audio.current?.pause();
    if (audio.current) audio.current.currentTime = 0;
    setPlaying(false);
  };
  useEffect(() => {
    const player = audio.current;
    const tracker = operation.current;
    const playback = playbackToken.current;
    return () => {
      tracker.sequence++;
      playback.sequence++;
      player?.pause();
      setBusy(false);
    };
  }, [setBusy]);
  const generate = () => {
    error("");
    // TODO: replace local illustration with approved image-generation service, preserving prompt/source/version and requiring teacher confirmation. Do not reuse Guoman's image as an invented new patient or simulate an AI progress timer.
    change({
      ...media,
      avatarKind: "illustration",
      avatarSrc: "",
      avatarGender: gender === "男" || gender === "女" ? gender : "未知",
      avatarAge: age.slice(0, 6),
      avatarVariant: (media.avatarVariant + 1) % 1001,
      appearanceDescription:
        media.appearanceDescription ||
        [age && `${age}岁`, gender, "患者示意形象"].filter(Boolean).join("，"),
    });
  };
  const upload = async (file?: File) => {
    if (!file) return;
    if (
      !/^image\/(png|jpeg|webp)$/.test(file.type) ||
      file.size > 1024 * 1024
    ) {
      error("患者形象支持1MB以内PNG/JPG/WebP。");
      return;
    }
    const id = ++operation.current.sequence;
    setBusy(true);
    error("");
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const img = new Image();
      img.src = src;
      await img.decode();
      if (id === operation.current.sequence)
        change({ ...media, avatarKind: "uploaded", avatarSrc: src });
    } catch {
      if (id === operation.current.sequence)
        error("患者图片无法读取，请检查文件格式。");
    } finally {
      if (id === operation.current.sequence) setBusy(false);
    }
  };
  return (
    <div className="t-patient-media-editor">
      <section>
        <h3>患者形象</h3>
        <div className="t-patient-image-builder">
          <div className="t-patient-image-preview">
            <PatientAvatar media={media} name={name} />
          </div>
          <div>
            <label>
              患者外貌描述
              <textarea
                aria-label="患者外貌描述"
                rows={4}
                maxLength={2000}
                value={media.appearanceDescription}
                disabled={busy}
                onChange={(e) =>
                  change({ ...media, appearanceDescription: e.target.value })
                }
                placeholder="年龄、相貌、衣着和就诊场景"
              />
            </label>
            <div className="t-media-actions">
              <button
                className="ghost-button"
                disabled={busy}
                onClick={generate}
              >
                {media.avatarKind === "none"
                  ? "生成患者形象"
                  : "重新生成患者形象"}
              </button>
              <label className="t-image-upload-button">
                上传形象
                <input
                  className="t-sr-only"
                  aria-label="上传患者形象"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    void upload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {media.avatarKind !== "none" && (
                <button
                  className="link-button"
                  disabled={busy}
                  onClick={() =>
                    change({
                      ...media,
                      ...defaultPatientMedia(),
                      appearanceDescription: media.appearanceDescription,
                      voiceId: media.voiceId,
                    })
                  }
                >
                  移除形象
                </button>
              )}
            </div>
            <p className="t-note">按年龄、性别生成示意头像，也可上传替换。</p>
          </div>
        </div>
      </section>
      <section className="t-patient-voice-picker">
        <div className="t-editor-row-head">
          <h3>患者声线</h3>
          <button
            className="ghost-button"
            disabled={busy || media.voiceId !== "female-middle"}
            onClick={async () => {
              error("");
              if (playing) {
                stop();
                return;
              }
              const request = ++playbackToken.current.sequence;
              try {
                await audio.current?.play();
              } catch {
                if (request === playbackToken.current.sequence)
                  error("声线试听未能播放，请重试。");
              }
            }}
          >
            {playing ? "停止试听" : "试听声线"}
          </button>
        </div>
        <div className="t-patient-voice-groups">
          {["男声", "女声"].map((group) => (
            <fieldset key={group} disabled={busy}>
              <legend>{group}</legend>
              <div>
                {patientVoices
                  .filter((v) => v.group === group)
                  .map((v) => (
                    <label
                      className={media.voiceId === v.id ? "selected" : ""}
                      key={v.id}
                    >
                      <input
                        type="radio"
                        name="patient-voice"
                        value={v.id}
                        checked={media.voiceId === v.id}
                        onChange={() => {
                          stop();
                          change({ ...media, voiceId: v.id });
                        }}
                      />
                      {v.name}
                    </label>
                  ))}
              </div>
            </fieldset>
          ))}
        </div>
        <p className="t-note">当前可试听中年女声（B），其余声线可先配置。</p>
        <audio
          ref={audio}
          src="/assets/patient-audio/turn-01.mp3"
          preload="none"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => {
            setPlaying(false);
            error("声线试听未能播放，请重试。");
          }}
        />
      </section>
    </div>
  );
}
