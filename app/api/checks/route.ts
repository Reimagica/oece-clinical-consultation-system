import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { fixedCheckResult, checkReporterPrompt, matchedCheckResult, type CheckKind } from "../../check-results";
export const runtime = "edge";
const requests = new Map<string, number[]>();

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const origin = request.headers.get("origin");
  try {
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return reply({ error: "请从当前站点生成检查结果。" }, 403);
  } catch { return reply({ error: "请求来源无效。" }, 403); }
  const ip = request.headers.get("cf-connecting-ip") ?? "local";
  const now = Date.now();
  const times = (requests.get(ip) ?? []).filter(time => now - time < 60_000);
  if (times.length >= 20) return reply({ error: "操作过于频繁，请稍后再试。" }, 429);
  requests.set(ip, [...times, now]);
  if (requests.size > 2000) for (const [client, values] of requests) if (values.every(time => now - time > 60_000)) requests.delete(client);
  if (Number(request.headers.get("content-length")) > 4000) return reply({ error: "检查名称过长。" }, 413);
  let payload: { kind?: unknown; label?: unknown };
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "请求为空。" }, 400);
    let size = 0, text = "";
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 4000) { await reader.cancel(); return reply({ error: "检查名称过长。" }, 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    payload = JSON.parse(text + decoder.decode());
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error();
  } catch { return reply({ error: "检查请求格式错误。" }, 400); }
  if ((payload.kind !== "physical" && payload.kind !== "auxiliary") || typeof payload.label !== "string" || !payload.label.trim() || payload.label.length > 200) return reply({ error: "请输入不超过200字的具体检查项目。" }, 400);
  const kind: CheckKind = payload.kind;
  const fixed = fixedCheckResult(kind, payload.label);
  const bindings = env as Record<string, string | undefined>;
  // Demo always returns deterministic source data; only an explicit server configuration enables model matching.
  if (bindings.CHECK_RESULT_MODE !== "deepseek" && process.env.CHECK_RESULT_MODE !== "deepseek") return reply({ result: fixed });
  const key = bindings.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!key) return reply({ error: "检查反馈服务尚未就绪。" }, 503);
  try {
    const upstream = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: "deepseek-flash", messages: [{ role: "system", content: checkReporterPrompt(kind) }, { role: "user", content: payload.label }], thinking: { type: "disabled" }, temperature: 0, response_format: { type: "json_object" }, max_tokens: 120, stream: false }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(18_000)]),
    });
    if (!upstream.ok) return reply({ error: "检查反馈服务暂不可用，请重试。" }, 502);
    const data = await upstream.json() as { choices?: { finish_reason?: string; message?: { content?: string } }[] };
    if (data.choices?.[0]?.finish_reason !== "stop") throw new Error();
    const match = JSON.parse(data.choices[0].message?.content ?? "") as { kind: string; key: string };
    if (!match || typeof match !== "object" || !["result", "clarification", "unavailable"].includes(match.kind)) throw new Error();
    return reply({ result: matchedCheckResult(kind, payload.label, match) });
  } catch { return reply({ error: "检查反馈连接超时或格式异常，请重试。" }, 504); }
}
