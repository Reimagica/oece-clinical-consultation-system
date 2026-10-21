import type { PatientVoiceId } from "./demo-data";

export const patientVoices: {
  id: PatientVoiceId;
  name: string;
  group: string;
}[] = [
  { id: "male-young", name: "青年男声", group: "男声" },
  { id: "male-middle", name: "中年男声", group: "男声" },
  { id: "male-senior", name: "老年男声", group: "男声" },
  { id: "female-young", name: "青年女声", group: "女声" },
  { id: "female-middle", name: "中年女声（B）", group: "女声" },
  { id: "female-senior", name: "老年女声", group: "女声" },
];
export type PatientMedia = {
  appearanceDescription: string;
  avatarKind: "none" | "existing" | "illustration" | "uploaded";
  avatarSrc: string;
  avatarGender: string;
  avatarAge: string;
  avatarVariant: number;
  voiceId: PatientVoiceId;
};
export function defaultPatientMedia(builtin = false): PatientMedia {
  return {
    appearanceDescription: builtin
      ? "58岁中国女性，内科病房场景，形象自然。"
      : "",
    avatarKind: builtin ? "existing" : "none",
    avatarSrc: builtin ? "/assets/patient-guoman.png" : "",
    avatarGender: builtin ? "女" : "未知",
    avatarAge: builtin ? "58" : "",
    avatarVariant: 0,
    voiceId: "female-middle",
  };
}
export function normalizePatientMedia(
  input: unknown,
  builtin = false,
): PatientMedia {
  if (!input || typeof input !== "object") return defaultPatientMedia(builtin);
  const raw = input as Record<string, unknown>,
    result = defaultPatientMedia();
  result.appearanceDescription =
    typeof raw.appearanceDescription === "string"
      ? raw.appearanceDescription.slice(0, 2000)
      : "";
  result.voiceId =
    patientVoices.find((v) => v.id === raw.voiceId)?.id || "female-middle";
  result.avatarGender =
    raw.avatarGender === "男" || raw.avatarGender === "女"
      ? raw.avatarGender
      : "未知";
  result.avatarAge =
    typeof raw.avatarAge === "string" ? raw.avatarAge.slice(0, 6) : "";
  result.avatarVariant =
    typeof raw.avatarVariant === "number" && Number.isFinite(raw.avatarVariant)
      ? Math.max(0, Math.min(Math.floor(raw.avatarVariant), 1000))
      : 0;
  if (raw.avatarKind === "illustration") result.avatarKind = "illustration";
  else if (raw.avatarSrc === "/assets/patient-guoman.png") {
    result.avatarSrc = raw.avatarSrc;
    result.avatarKind = "existing";
  } else if (
    typeof raw.avatarSrc === "string" &&
    /^data:image\/(png|jpeg|webp);base64,/.test(raw.avatarSrc) &&
    raw.avatarSrc.length < 1400000
  ) {
    result.avatarSrc = raw.avatarSrc;
    result.avatarKind = "uploaded";
  }
  return result;
}
