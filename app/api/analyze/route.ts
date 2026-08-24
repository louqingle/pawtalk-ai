import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    // =========================
    // 1. 检查 DeepSeek API
    // =========================

    const deepseekKey =
      process.env.DEEPSEEK_API_KEY;

    if (!deepseekKey) {
      return json(
        {
          error:
            "服务器没有配置 DEEPSEEK_API_KEY",
        },
        500
      );
    }

    // =========================
    // 2. 检查登录
    // =========================

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },

          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(
                ({
                  name,
                  value,
                  options,
                }) => {
                  cookieStore.set(
                    name,
                    value,
                    options
                  );
                }
              );
            } catch {}
          },
        },
      }
    );

    const {
      data: {
        user,
      },
    } = await supabase.auth.getUser();

    if (!user) {
      return json(
        {
          error: "请先登录",
        },
        401
      );
    }

    // =========================
    // 3. 获取上传内容
    // =========================

    const formData =
      await req.formData();

    const animal =
      String(
        formData.get("animal") ||
          "猫咪"
      );

    const source =
      String(
        formData.get("source") ||
          "声音"
      );

    const file =
      formData.get("file");

    const audioFeaturesRaw =
      formData.get(
        "audioFeatures"
      );

    if (!(file instanceof File)) {
      return json(
        {
          error:
            "没有收到音频或图片文件",
        },
        400
      );
    }

    // =========================
    // 4. 文件基本检查
    // =========================

    if (file.size === 0) {
      return json(
        {
          error: "上传文件为空",
        },
        400
      );
    }

    if (
      file.size >
      20 * 1024 * 1024
    ) {
      return json(
        {
          error:
            "文件不能超过 20MB",
        },
        400
      );
    }

    // =========================
    // 5. 额度检查
    // =========================

    const {
      data: creditData,
      error: creditError,
    } = await supabase
      .from("profiles")
      .select(
        "free_uses, is_pro"
      )
      .eq(
        "id",
        user.id
      )
      .maybeSingle();

    if (creditError) {
      console.error(
        "Credit query error:",
        creditError
      );
    }

    const freeUses =
      Number(
        creditData?.free_uses ??
          0
      );

    const isPro =
      Boolean(
        creditData?.is_pro
      );

    if (
      !isPro &&
      freeUses >= 5
    ) {
      return json(
        {
          error:
            "免费次数已经用完",
        },
        402
      );
    }

    // =========================
    // 6. 解析音频特征
    // =========================

    let audioFeatures =
      null;

    if (
      audioFeaturesRaw
    ) {
      try {
        audioFeatures =
          JSON.parse(
            String(
              audioFeaturesRaw
            )
          );
      } catch {
        audioFeatures =
          null;
      }
    }

    // =========================
    // 7. 读取文件
    // =========================

    const bytes =
      await file.arrayBuffer();

    const base64 =
      Buffer.from(
        bytes
      ).toString("base64");

    // =========================
    // 8. 构造 AI 请求
    // =========================

    let userContent: any;

    if (
      source === "照片"
    ) {
      userContent = [
        {
          type: "text",
          text: `
你是 PawTalk AI，一款宠物行为分析工具。

请分析这张${animal}照片。

不要声称你真的能够翻译动物语言。
只能根据照片中可以观察到的：
- 姿势
- 表情
- 耳朵
- 眼睛
- 尾巴
- 身体状态
- 周围环境

推测它可能的情绪和互动需求。

请严格返回 JSON，不要 Markdown：

{
  "phrase": "一句拟人化但明确属于推测的话",
  "mood": "当前可能状态",
  "attention": 0,
  "tension": 0,
  "excitement": 0,
  "confidence": 0,
  "detail": "观察到的主要线索",
  "nextTip": "建议主人下一步怎么做"
}

所有数字 0-100。
          `,
        },
        {
          type: "image_url",
          image_url: {
            url:
              `data:${file.type};base64,${base64}`,
          },
        },
      ];
    } else {
      userContent = `
你是 PawTalk AI，一款宠物声音行为分析工具。

动物：${animal}

这是一次宠物声音分析。

下面是浏览器从录音中提取的基础声学特征：

${JSON.stringify(
  audioFeatures,
  null,
  2
)}

请根据这些声学特征进行谨慎的行为推测。

不要声称你真的能够翻译动物语言。
不要伪装成科学上已经证明的动物语言翻译器。

请严格返回 JSON，不要 Markdown：

{
  "phrase": "一句拟人化但明确属于推测的话",
  "mood": "当前可能状态",
  "attention": 0,
  "tension": 0,
  "excitement": 0,
  "confidence": 0,
  "detail": "根据声音特征进行解释",
  "nextTip": "建议主人下一步怎么做"
}

所有数字必须是 0-100。
      `;
    }

    // =========================
    // 9. 调用 DeepSeek
    // =========================

    const response =
      await fetch(
        DEEPSEEK_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${deepseekKey}`,
          },

          body: JSON.stringify({
            model:
              process.env.DEEPSEEK_MODEL ||
              "deepseek-chat",

            messages: [
              {
                role: "system",
                content:
                  "你是 PawTalk AI 的宠物行为分析模型。必须严格输出 JSON。",
              },

              {
                role: "user",
                content:
                  userContent,
              },
            ],

            temperature: 0.4,

            response_format: {
              type: "json_object",
            },
          }),
        }
      );

    const deepseekData =
      await response.json();

    if (!response.ok) {
      console.error(
        "DeepSeek error:",
        deepseekData
      );

      return json(
        {
          error:
            deepseekData?.error
              ?.message ||
            "DeepSeek API 调用失败",
        },
        502
      );
    }

    const content =
      deepseekData
        ?.choices?.[0]
        ?.message?.content;

    if (!content) {
      return json(
        {
          error:
            "AI 没有返回分析结果",
        },
        502
      );
    }

    // =========================
    // 10. 解析 AI JSON
    // =========================

    let result;

    try {
      result =
        JSON.parse(content);
    } catch {
      console.error(
        "AI JSON parse error:",
        content
      );

      return json(
        {
          error:
            "AI 返回格式错误，请重试",
        },
        502
      );
    }

    // =========================
    // 11. 规范数据
    // =========================

    const finalResult = {
      phrase:
        String(
          result.phrase ||
            "它似乎正在表达某种需求。"
        ),

      mood:
        String(
          result.mood ||
            "状态不确定"
        ),

      attention:
        Math.min(
          100,
          Math.max(
            0,
            Number(
              result.attention ||
                0
            )
          )
        ),

      tension:
        Math.min(
          100,
          Math.max(
            0,
            Number(
              result.tension ||
                0
            )
          )
        ),

      excitement:
        Math.min(
          100,
          Math.max(
            0,
            Number(
              result.excitement ||
                0
            )
          )
        ),

      confidence:
        Math.min(
          100,
          Math.max(
            0,
            Number(
              result.confidence ||
                0
            )
          )
        ),

      detail:
        String(
          result.detail ||
            "目前可观察线索有限。"
        ),

      nextTip:
        String(
          result.nextTip ||
            "继续观察宠物的行为变化。"
        ),
    };

    // =========================
    // 12. 成功后扣一次额度
    // =========================

    if (!isPro) {
      const newUses =
        freeUses + 1;

      const {
        error:
          updateError,
      } = await supabase
        .from("profiles")
        .update({
          free_uses:
            newUses,
        })
        .eq(
          "id",
          user.id
        );

      if (updateError) {
        console.error(
          "Credit update error:",
          updateError
        );
      }
    }

    return json(
      finalResult,
      200
    );
  } catch (error: any) {
    console.error(
      "Analyze API error:",
      error
    );

    return json(
      {
        error:
          error?.message ||
          "服务器分析失败",
      },
      500
    );
  }
}
