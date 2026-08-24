import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  try {
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

    // 检查登录用户
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

    // 获取用户额度
    const {
      data: profile,
      error: profileError,
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

    if (profileError) {
      console.error(
        "Credits profile error:",
        profileError
      );

      return json(
        {
          error:
            "读取用户额度失败",
        },
        500
      );
    }

    // 如果用户没有 profile
    if (!profile) {
      return json({
        used: 0,
        remaining: 5,
        isPro: false,
      });
    }

    const used = Math.max(
      0,
      Number(
        profile.free_uses ?? 0
      )
    );

    const isPro =
      Boolean(
        profile.is_pro
      );

    const remaining =
      isPro
        ? 999999
        : Math.max(
            0,
            5 - used
          );

    return json({
      used,
      remaining,
      isPro,
    });
  } catch (error: any) {
    console.error(
      "Credits API error:",
      error
    );

    return json(
      {
        error:
          error?.message ||
          "读取额度失败",
      },
      500
    );
  }
}
