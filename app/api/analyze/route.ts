import { NextRequest, NextResponse } from "next/server";

const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-pro";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

async function deepseek(messages: Array<{ role: string; content: string }>) {
  const key = process.env.DEEPSEEK_API_KEY;

  if (!key) {
    throw new Error("DEEPSEEK_API_KEY_MISSING");
  }

  const response = await fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      thinking: {
        type: "enabled",
      },
      reasoning_effort: "high",
      response_format: {
        type: "json_object",
      },
      max_tokens: 800,
      stream: false,
    }),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message || "DeepSeek API 请求失败"
    );
  }

  return body;
}

const systemPrompt = `
你是 PawTalk AI，一款宠物行为观察助手。

你的任务不是声称自己真的听懂了动物语言，而是根据用户提供的动物类型、输入类型以及可获得的行为线索，进行谨慎的行为推断。

必须遵守：

1. 不得声称真正翻译了动物语言。
2. 不得进行疾病诊断。
3. 不确定时降低 confidence。
4. 不要编造不存在的声音、姿态或环境信息。
5. 输出必须是合法 JSON。
6. 所有 attention、tension、excitement、confidence 必须是 1-99 的整数。

必须严格返回：

{
  "phrase": "一句简短的人类语言解释",
  "mood": "当前可能的情绪",
  "attention": 1-99,
  "tension": 1-99,
  "excitement": 1-99,
  "confidence": 1-99,
  "detail": "简短解释判断依据",
  "nextTip": "给宠物主人的下一步建议"
}

phrase 示例：
"可能是在寻求关注"

注意：
这是行为推断，不是真正的动物语言翻译。
`;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();

    const animal = String(
      form.get("animal") || "其他"
    );

    const source = String(
      form.get("source") || "声音"
    );

    const file = form.get("file");

    if (!(file instanceof File)) {
      return json(
        { error: "请上传文件" },
        400
      );
    }

    if (file.size > 12 * 1024 * 1024) {
      return json(
        { error: "文件不能超过 12MB" },
        400
      );
    }

    let prompt = `
动物类型：${animal}

输入类型：${source}

请根据目前能够获得的信息，对这只动物的行为状态进行谨慎推断。

${systemPrompt}
`;

    /*
     * 照片模式
     *
     * 当前先不把图片直接发送给 DeepSeek。
     * 因为你这个接口目前主要使用 DeepSeek 文本模型。
     *
     * 后续如果要做真正的图片理解，
     * 我们再单独接视觉模型。
     */
    if (source === "照片") {
      prompt += `
用户上传了一张 ${animal} 的照片。

当前后端没有可靠的视觉识别结果，因此：
不要假装看到了照片中的具体细节。

请基于“照片分析能力有限”这一事实，
返回一个保守的行为观察结果。

confidence 请保持较低。
`;
    }

    /*
     * 声音模式
     *
     * DeepSeek 本身在这里不负责音频转写。
     * 因此不能把音频文件直接伪装成文本交给 DeepSeek。
     *
     * 当前版本会告诉模型：
     * 输入是动物声音，但缺少可靠的音频特征。
     */
    if (source !== "照片") {
      prompt += `
用户上传了一段 ${animal} 的声音。

目前系统没有可靠的动物声音声学特征提取结果。

因此：
不要虚构音频内容。
不要声称听到了某个具体叫声。
不要声称真正翻译了动物语言。

请给出一个保守的行为推断。
confidence 不宜过高。
`;
    }

    const result = await deepseek([
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: prompt,
      },
    ]);

    const text =
      result?.choices?.[0]?.message?.content;

    if (!text) {
      return json(
        { error: "DeepSeek 没有返回分析结果" },
        502
      );
    }

    let parsed: any;

    try {
      parsed =
        typeof text === "string"
          ? JSON.parse(text)
          : text;
    } catch {
      return json(
        {
          error:
            "DeepSeek 返回的数据格式异常，请再试一次",
        },
        502
      );
    }

    /*
     * 安全修正数值
     */
    const clamp = (value: any) => {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return 50;
      }

      return Math.max(
        1,
        Math.min(99, Math.round(number))
      );
    };

    const resultData = {
      phrase:
        String(
          parsed?.phrase ||
            "可能是在表达某种需求"
        ).slice(0, 200),

      mood:
        String(
          parsed?.mood ||
            "状态不确定"
        ).slice(0, 100),

      attention: clamp(
        parsed?.attention
      ),

      tension: clamp(
        parsed?.tension
      ),

      excitement: clamp(
        parsed?.excitement
      ),

      confidence: clamp(
        parsed?.confidence
      ),

      detail:
        String(
          parsed?.detail ||
            "目前信息有限，只能进行保守的行为推断。"
        ).slice(0, 500),

      nextTip:
        String(
          parsed?.nextTip ||
            "继续观察宠物的身体语言和周围环境。"
        ).slice(0, 300),

      animal,
      source,
    };

    return json(resultData);
  } catch (error: any) {
    console.error("PawTalk API Error:", error);

    if (
      error?.message ===
      "DEEPSEEK_API_KEY_MISSING"
    ) {
      return json(
        {
          error:
            "服务器还没有配置 DEEPSEEK_API_KEY。",
        },
        503
      );
    }

    return json(
      {
        error:
          error?.message ||
          "服务器发生错误，请稍后再试。",
      },
      500
    );
  }
}
