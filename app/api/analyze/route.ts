import { NextRequest, NextResponse } from "next/server";

const MODEL =
  process.env.DEEPSEEK_MODEL ||
  "deepseek-v4-pro";

const DEEPSEEK_URL =
  "https://api.deepseek.com/chat/completions";

function json(
  data: unknown,
  status = 200
) {
  return NextResponse.json(
    data,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}

async function deepseek(
  messages: Array<{
    role: "system" | "user";
    content: string;
  }>
) {
  const key =
    process.env.DEEPSEEK_API_KEY;

  if (!key) {
    throw new Error(
      "DEEPSEEK_API_KEY_MISSING"
    );
  }

  const response =
    await fetch(
      DEEPSEEK_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${key}`,
        },

        body: JSON.stringify({
          model: MODEL,

          messages,

          response_format: {
            type: "json_object",
          },

          temperature: 0.3,

          max_tokens: 800,

          stream: false,
        }),
      }
    );

  const body =
    await response.json();

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        "DeepSeek API 请求失败"
    );
  }

  return body;
}

const SYSTEM_PROMPT = `
你是 PawTalk AI，一款宠物行为观察助手。

你的任务是根据动物类型、输入类型以及可获得的声音或视觉线索，对动物当前可能的行为状态进行谨慎推断。

你不是动物语言翻译器。

绝对不能声称：
“动物真正说了某句话”。

必须使用：
“可能”
“更像是”
“推测”
“根据当前线索”

等谨慎表达。

不要进行疾病诊断。

不要编造不存在的信息。

如果证据不足，confidence 必须降低。

所有 attention、tension、excitement、confidence
必须是 1-99 的整数。

严格返回 JSON：

{
  "phrase": "一句简短的人类语言解释",
  "mood": "当前可能的情绪",
  "attention": 1,
  "tension": 1,
  "excitement": 1,
  "confidence": 1,
  "detail": "判断依据",
  "nextTip": "给主人下一步建议"
}

phrase 应该简洁。

例如：

“可能是在寻求关注”

而不是：

“它说主人快来陪我玩。”

这是行为推断，不是真正的动物语言翻译。
`;

export async function POST(
  req: NextRequest
) {
  try {
    const form =
      await req.formData();

    const animal =
      String(
        form.get("animal") ||
          "其他"
      );

    const source =
      String(
        form.get("source") ||
          "声音"
      );

    const file =
      form.get("file");

    if (
      !(file instanceof File)
    ) {
      return json(
        {
          error:
            "请上传文件",
        },
        400
      );
    }

    if (
      file.size >
      12 * 1024 * 1024
    ) {
      return json(
        {
          error:
            "文件不能超过 12MB",
        },
        400
      );
    }

    const audioFeaturesRaw =
      String(
        form.get(
          "audioFeatures"
        ) || ""
      );

    let audioFeatures:
      | Record<
          string,
          number
        >
      | null = null;

    if (
      audioFeaturesRaw
    ) {
      try {
        audioFeatures =
          JSON.parse(
            audioFeaturesRaw
          );
      } catch {
        audioFeatures =
          null;
      }
    }

    let prompt = `
动物类型：${animal}

输入类型：${source}

`;

    /*
     * 声音分析
     */
    if (
      source !== "照片"
    ) {
      prompt += `
这是一次动物声音行为分析。

浏览器端提取到了以下基础声学特征：

${
  audioFeatures
    ? JSON.stringify(
        audioFeatures,
        null,
        2
      )
    : "没有成功提取音频特征"
}

请根据这些特征进行谨慎的行为推断。

重要：

- duration 是声音持续时间。
- rms 可以粗略反映整体能量。
- peak 是峰值振幅。
- silenceRatio 是静音比例。
- zeroCrossingRate 是零交叉率。
- estimatedFrequency 是非常粗略的频率估计。

不要把单一指标直接等同于某一种情绪。

不要说：
“它正在说……”

应该说：
“它可能……”

如果证据不足，请降低 confidence。
`;
    }

    /*
     * 照片分析
     *
     * 当前版本仍然使用文本模型，
     * 因此不会假装模型真的看到了图片。
     */
    if (
      source === "照片"
    ) {
      prompt += `
用户上传了一张 ${animal} 的照片。

当前 API 没有可靠的视觉模型结果。

因此不要编造：
- 耳朵姿态
- 尾巴姿态
- 眼睛状态
- 身体姿态
- 环境
- 表情

请保守输出，并降低 confidence。

不要声称已经准确识别照片内容。
`;
    }

    prompt += `

请严格返回 JSON。
`;

    const response =
      await deepseek([
        {
          role: "system",
          content:
            SYSTEM_PROMPT,
        },
        {
          role: "user",
          content:
            prompt,
        },
      ]);

    const text =
      response?.choices?.[0]
        ?.message?.content;

    if (!text) {
      return json(
        {
          error:
            "DeepSeek 没有返回分析结果",
        },
        502
      );
    }

    let parsed: any;

    try {
      parsed =
        typeof text ===
        "string"
          ? JSON.parse(text)
          : text;
    } catch {
      return json(
        {
          error:
            "AI 返回格式异常，请再试一次",
        },
        502
      );
    }

    const clamp =
      (value: any) => {
        const number =
          Number(value);

        if (
          !Number.isFinite(
            number
          )
        ) {
          return 50;
        }

        return Math.max(
          1,
          Math.min(
            99,
            Math.round(
              number
            )
          )
        );
      };

    const result = {
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

      attention:
        clamp(
          parsed?.attention
        ),

      tension:
        clamp(
          parsed?.tension
        ),

      excitement:
        clamp(
          parsed?.excitement
        ),

      confidence:
        clamp(
          parsed?.confidence
        ),

      detail:
        String(
          parsed?.detail ||
            "当前信息有限，只能进行保守的行为推断。"
        ).slice(0, 500),

      nextTip:
        String(
          parsed?.nextTip ||
            "继续观察宠物的声音、身体语言以及周围环境。"
        ).slice(0, 300),

      animal,

      source,
    };

    return json(
      result
    );
  } catch (
    error: any
  ) {
    console.error(
      "PawTalk API Error:",
      error
    );

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
