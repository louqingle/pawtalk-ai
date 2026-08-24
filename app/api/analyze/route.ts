import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const DEEPSEEK_URL =
  "https://api.deepseek.com/chat/completions";

const MODEL =
  process.env.DEEPSEEK_MODEL ||
  "deepseek-chat";

function json(
  data: unknown,
  status = 200
) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(
  request: NextRequest
) {
  try {
    /*
     * =========================
     * 1. Supabase 登录验证
     * =========================
     */

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
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return json(
        {
          error: "请先登录",
        },
        401
      );
    }

    /*
     * =========================
     * 2. 读取用户权限
     * =========================
     */

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select(
        "free_credits, is_pro"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Profile error:",
        profileError
      );

      return json(
        {
          error: "读取用户权限失败",
        },
        500
      );
    }

    if (!profile) {
      return json(
        {
          error:
            "用户资料不存在，请重新登录",
        },
        404
      );
    }

    const isPro =
      Boolean(profile.is_pro);

    const credits = Math.max(
      0,
      Number(
        profile.free_credits ?? 0
      )
    );

    /*
     * =========================
     * 3. 普通用户检查额度
     * =========================
     */

    if (!isPro && credits <= 0) {
      return json(
        {
          error:
            "免费分析次数已用完",
          code: "NO_CREDITS",
          remaining: 0,
          isPro: false,
        },
        402
      );
    }

    /*
     * =========================
     * 4. 读取 FormData
     * =========================
     */

    const formData =
      await request.formData();

    const animal =
      String(
        formData.get("animal") ||
          "宠物"
      );

    const source =
      String(
        formData.get("source") ||
          "audio"
      );

    const audioFeaturesRaw =
      formData.get(
        "audioFeatures"
      );

    let audioFeatures:
      | unknown
      | null = null;

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
        audioFeatures = null;
      }
    }

    /*
     * =========================
     * 5. 生成 DeepSeek Prompt
     * =========================
     */

    const prompt = `
你是一名专业的宠物行为分析助手。

请根据用户提供的宠物信息和音频特征，
分析宠物当前最可能的情绪、需求和行为原因。

宠物类型：
${animal}

数据来源：
${source}

音频特征：
${JSON.stringify(
  audioFeatures ?? {},
  null,
  2
)}

请用中文回答，并严格按照以下结构：

【情绪】
给出最可能的情绪，并说明判断依据。

【它可能想表达什么】
用普通主人能理解的话解释。

【可能原因】
列出 2-4 个最可能原因。

【建议】
给主人 3-5 条实际可执行的建议。

【可信度】
给出 0-100 的估计值，并说明为什么不是 100%。

注意：
1. 不要声称可以真正翻译动物语言。
2. 这是基于声音特征和行为信息的概率分析。
3. 不要编造不存在的医学诊断。
4. 如果信息不足，要明确说明不确定性。
`;

    /*
     * =========================
     * 6. 检查 DeepSeek Key
     * =========================
     */

    const apiKey =
      process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      console.error(
        "DEEPSEEK_API_KEY is missing"
      );

      return json(
        {
          error:
            "服务器没有配置 DeepSeek API Key",
        },
        500
      );
    }

    /*
     * =========================
     * 7. 调用 DeepSeek
     * =========================
     */

    const deepseekResponse =
      await fetch(
        DEEPSEEK_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${apiKey}`,
          },

          body: JSON.stringify({
            model: MODEL,

            messages: [
              {
                role: "system",
                content:
                  "你是一个专业、谨慎的宠物行为分析助手。",
              },

              {
                role: "user",
                content:
                  prompt,
              },
            ],

            temperature: 0.7,

            max_tokens: 1200,
          }),

          cache: "no-store",
        }
      );

    const deepseekData =
      await deepseekResponse.json();

    /*
     * =========================
     * 8. DeepSeek 失败
     * =========================
     *
     * 重要：
     * 只有 DeepSeek 成功以后才扣额度。
     */

    if (
      !deepseekResponse.ok
    ) {
      console.error(
        "DeepSeek error:",
        deepseekData
      );

      return json(
        {
          error:
            deepseekData?.error
              ?.message ||
            "AI 分析失败，请稍后重试",
        },
        502
      );
    }

    const result =
      deepseekData?.choices?.[0]
        ?.message?.content;

    if (!result) {
      return json(
        {
          error:
            "AI 没有返回有效分析结果",
        },
        502
      );
    }

    /*
     * =========================
     * 9. AI 成功后扣 1 次
     * =========================
     */

    let remaining =
      isPro
        ? 999999
        : credits;

    if (!isPro) {
      const {
        data: newRemaining,
        error: creditError,
      } = await supabase.rpc(
        "use_free_credit"
      );

      if (creditError) {
        console.error(
          "Credit deduction error:",
          creditError
        );

        /*
         * AI 已经成功，但额度扣除失败。
         * 不应该让用户重复获得免费额度。
         */
        return json(
          {
            error:
              "分析完成，但额度结算失败，请联系客服",
          },
          500
        );
      }

      remaining =
        Number(
          newRemaining ?? 0
        );
    }

    /*
     * =========================
     * 10. 返回结果
     * =========================
     */

    return json({
      success: true,

      result,

      analysis: result,

      isPro,

      remaining,

      used: isPro
        ? 0
        : Math.max(
            0,
            5 - remaining
          ),
    });
  } catch (error: any) {
    console.error(
      "Analyze API error:",
      error
    );

    return json(
      {
        error:
          error?.message ||
          "分析失败，请稍后重试",
      },
      500
    );
  }
}
