import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          isPro: false,
          error: "未登录",
        },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        {
          isPro: false,
          error: "登录已失效",
        },
        { status: 401 }
      );
    }

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("subscription query error:", error);

      return NextResponse.json(
        {
          isPro: false,
          error: "查询会员状态失败",
        },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json({
        isPro: false,
        plan: null,
        expiresAt: null,
      });
    }

    const expired =
      new Date(subscription.expires_at).getTime() <= Date.now();

    if (expired) {
      await supabase
        .from("subscriptions")
        .update({
          status: "expired",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      return NextResponse.json({
        isPro: false,
        plan: subscription.plan,
        expiresAt: subscription.expires_at,
      });
    }

    return NextResponse.json({
      isPro: subscription.status === "active",
      plan: subscription.plan,
      expiresAt: subscription.expires_at,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        isPro: false,
        error: "服务器错误",
      },
      { status: 500 }
    );
  }
}
