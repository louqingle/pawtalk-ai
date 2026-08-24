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
                ({ name, value, options }) => {
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

    const {
      data: profile,
      error: profileError,
    } = await supabase
      .from("profiles")
      .select("free_credits, is_pro")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Credits profile error:",
        profileError
      );

      return json(
        {
          error: "读取用户额度失败",
        },
        500
      );
    }

    if (!profile) {
      return json({
        used: 5,
        remaining: 0,
        isPro: false,
      });
    }

    const freeCredits = Math.max(
      0,
      Number(profile.free_credits ?? 0)
    );

    const isPro = Boolean(profile.is_pro);

    const remaining = isPro
      ? 999999
      : freeCredits;

    const used = isPro
      ? 0
      : Math.max(
          0,
          5 - freeCredits
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
