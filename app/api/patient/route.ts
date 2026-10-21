import { NextResponse } from "next/server";
import { env } from "cloudflare:workers";
import { patientSystemPrompt, supplementalPatientPrompt } from "./patient-harness";

export const runtime = "edge";

type DialogueMessage = { role: "user" | "assistant"; content: string };
const recentRequests = new Map<string, number[]>();

function limited(client: string, now: number) {
  const previous = (recentRequests.get(client) ?? []).filter((time) => now - time < 60_000);
  if (previous.length >= 10) return true;
  previous.push(now);
  recentRequests.set(client, previous);
  if (recentRequests.size > 2_000) {
    for (const [key, times] of recentRequests) {
      if (times.every((time) => now - time >= 60_000)) recentRequests.delete(key);
    }
  }
  return false;
}

export async function POST(request: Request) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const reply = (body: { answer?: string; error?: string }, status: number) => {
    // Operational metadata only: never log keys, patient/student text or IPs.
    console.info(JSON.stringify({ event: "patient_request", requestId, status, elapsedMs: Date.now() - started, promptVersion: "hf-20261006" }));
    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId, ...(status === 429 ? { "Retry-After": "60" } : {}) } });
  };
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return reply({ error: "仅允许从当前演示站点发起问诊。" }, 403);
  }
  const client = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (limited(client, Date.now())) {
    return reply({ error: "提问过于频繁，请一分钟后继续。" }, 429);
  }
  const key = (env as Record<string, string | undefined>).DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!key) {
    return reply({ error: "实时患者服务尚未就绪。病患对话演示仍可使用。" }, 503);
  }

  let payload: { question?: unknown; history?: unknown; mode?: unknown };
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "请求内容为空。" }, 400);
    let size = 0;
    let text = "";
    const decoder = new TextDecoder();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > 32_000) { await reader.cancel(); return reply({ error: "请求内容过长，请缩短问题。" }, 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    const parsed: unknown = JSON.parse(text + decoder.decode());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "请求格式错误。" }, 400);
    payload = parsed;
  } catch {
    return reply({ error: "请求格式错误。" }, 400);
  }
  const question = typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question || question.length > 500) {
    return reply({ error: "请输入不超过 500 字的问题。" }, 400);
  }
  const history: DialogueMessage[] = Array.isArray(payload.history)
    ? payload.history.slice(-16).filter((item): item is DialogueMessage =>
        item && (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" && item.content.length <= 500,
      )
    : [];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);
    let upstream: Response;
    try {
      upstream = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "deepseek-flash",
          messages: [{ role: "system", content: payload.mode === "supplemental" ? `${patientSystemPrompt}\n${supplementalPatientPrompt}` : patientSystemPrompt }, ...history, { role: "user", content: question }],
          stream: false,
          thinking: { type: "disabled" },
          temperature: 0.2,
          response_format: { type: "json_object" },
          max_tokens: 180,
        }),
        signal: AbortSignal.any([controller.signal, request.signal]),
      });
    } finally {
      clearTimeout(timer);
    }
    if (!upstream.ok) {
      return reply({ error: "实时患者服务暂不可用，请稍后再试。" }, 502);
    }
    const result = await upstream.json() as { choices?: Array<{ finish_reason?: string; message?: { content?: string } }> };
    const completion = result.choices?.[0];
    if (completion?.finish_reason !== "stop" || !completion.message?.content) {
      return reply({ error: "患者回答未完成，请重试。" }, 502);
    }
    let answer = "";
    try {
      const parsed = JSON.parse(completion.message.content) as { answer?: unknown };
      answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    } catch {
      return reply({ error: "患者回答格式异常，请重试。" }, 502);
    }
    if (!answer || answer.length > 200 || /```|<script|系统提示词|评分标准/.test(answer)) {
      return reply({ error: "患者回答需要重新生成，请重试。" }, 502);
    }
    return reply({ answer }, 200);
  } catch {
    return reply({ error: "实时患者连接超时，请稍后重试。" }, 504);
  }
}
