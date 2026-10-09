import { NextResponse } from "next/server";
import catalog from "../../diagnosis-catalog.json";

export const runtime = "edge";

const entries = catalog.map(({ code, name, abbreviation }) => ({
  code,
  name,
  abbreviation: abbreviation.toLowerCase(),
  normalizedName: name.toLowerCase().replace(/[\s·、，,（）()]/g, ""),
}));

export function searchDiagnoses(query: string) {
  const needle = query.trim().toLowerCase().replace(/[\s·、，,（）()]/g, "");
  if (!needle || needle.length > 40) return [];
  const ranked: Array<{ score: number; code: string; name: string }> = [];
  for (const entry of entries) {
    const index = entry.normalizedName.indexOf(needle);
    const phonetic = entry.abbreviation.indexOf(needle);
    if (index < 0 && phonetic < 0) continue;
    const score = entry.normalizedName === needle ? 0 : index === 0 ? 1 : index > 0 ? 2 : phonetic === 0 ? 3 : 4;
    ranked.push({ score, code: entry.code, name: entry.name });
  }
  ranked.sort((a, b) => a.score - b.score || a.name.length - b.name.length || a.name.localeCompare(b.name, "zh-CN"));
  const seen = new Set<string>();
  return ranked.filter(entry => { if (seen.has(entry.name)) return false; seen.add(entry.name); return true; }).slice(0, 12).map(({ code, name }) => ({ code, name }));
}

export function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({ items: searchDiagnoses(query) }, { headers: { "Cache-Control": "public, max-age=60" } });
}
