import { NextRequest, NextResponse } from "next/server";

const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-luna";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

async function openai(path: string, init: RequestInit) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY_MISSING");
  return fetch(`https://api.openai.com/v1/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, ...(init.headers || {}) },
  });
}

const schemaInstruction = `Return ONLY valid JSON with this exact shape:
{"phrase":"string","mood":"string","attention":number,"tension":number,"excitement":number,"confidence":number,"detail":"string","nextTip":"string"}
All numbers 1-99. Be conservative. Never claim you literally translated animal language. Explain that this is behavioral inference from available signals.`;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const animal = String(form.get("animal") || "其他");
    const source = String(form.get("source") || "声音");
    const file = form.get("file");
    if (!(file instanceof File)) return json({ error: "请上传文件" }, 400);
    if (file.size > 12 * 1024 * 1024) return json({ error: "文件不能超过 12MB" }, 400);

    let prompt = `你是 PawTalk AI，一款宠物行为观察助手。动物类型：${animal}。输入类型：${source}。\n${schemaInstruction}`;
    let imageData: string | null = null;

    if (source === "照片") {
      const bytes = Buffer.from(await file.arrayBuffer());
      const mime = file.type || "image/jpeg";
      imageData = `data:${mime};base64,${bytes.toString("base64")}`;
      prompt += `\n请观察姿态、耳朵/尾巴、面部、身体张力和环境线索。不要做疾病诊断。`;
    } else {
      const fd = new FormData();
      fd.append("file", new Blob([await file.arrayBuffer()], { type: file.type || "audio/webm" }), file.name || "pet-audio.webm");
      fd.append("model", "gpt-4o-mini-transcribe");
      fd.append("response_format", "text");
      const tr = await openai("audio/transcriptions", { method: "POST", body: fd });
      const transcript = await tr.text();
      if (!tr.ok) return json({ error: `音频处理失败：${transcript.slice(0, 300)}` }, 502);
      prompt += `\n音频转写/识别辅助信息：${transcript.slice(0, 2000)}\n注意：动物叫声的转写可能没有语义，不要把转写文本当成真实动物语言。请基于可用信息谨慎推断。`;
    }

    const input: any[] = [{ role: "user", content: imageData ? [
      { type: "input_text", text: prompt },
      { type: "input_image", image_url: imageData },
    ] : prompt }];

    const r = await openai("responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, input, max_output_tokens: 500 }),
    });
    const body = await r.json();
    if (!r.ok) return json({ error: body?.error?.message || "AI 分析失败" }, 502);
    const text = body.output_text || body.output?.flatMap((x: any) => x.content || []).find((x: any) => x.type === "output_text")?.text || "";
    const clean = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    let parsed: any;
    try { parsed = JSON.parse(clean); } catch { return json({ error: "AI 返回格式异常，请再试一次" }, 502); }
    return json({ ...parsed, animal, source });
  } catch (e: any) {
    if (e?.message === "OPENAI_API_KEY_MISSING") return json({ error: "服务器还没有配置 OPENAI_API_KEY。" }, 503);
    return json({ error: e?.message || "服务器错误" }, 500);
  }
}
