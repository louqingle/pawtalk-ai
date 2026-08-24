"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthProps = {
  onSuccess?: () => void;
};

export default function Auth({
  onSuccess,
}: AuthProps) {
  const supabase = createClient();

  const [mode, setMode] =
    useState<"login" | "signup">("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function submit() {
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }

    if (!password) {
      setError("请输入密码");
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        const {
          data,
          error: loginError,
        } =
          await supabase.auth.signInWithPassword(
            {
              email: email.trim(),
              password,
            }
          );
        console.log("LOGIN RESULT:", {
  data,
  error: loginError,
});

        if (loginError) {
          throw loginError;
        }

        if (!data.user) {
          throw new Error(
            "登录失败，请重试"
          );
        }

        setMessage("登录成功");

        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }

        return;
      }

      const {
        data,
        error: signupError,
      } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      if (signupError) {
        throw signupError;
      }

      if (!data.user) {
        throw new Error(
          "注册失败，请重试"
        );
      }

      if (
        data.session
      ) {
        setMessage("注册成功");

        if (onSuccess) {
          onSuccess();
        } else {
          window.location.reload();
        }
      } else {
        setMessage(
          "注册成功！请检查邮箱并点击验证链接，然后回来登录。"
        );
      }
    } catch (err: any) {
      console.error(
        "Auth error:",
        err
      );

      const errorMessage =
        err?.message ||
        "操作失败，请稍后再试";

      if (
        errorMessage.includes(
          "Invalid login credentials"
        )
      ) {
        setError(
          "邮箱或密码错误"
        );
      } else if (
        errorMessage.includes(
          "User already registered"
        )
      ) {
        setError(
          "这个邮箱已经注册，请直接登录"
        );
      } else if (
        errorMessage.includes(
          "Email not confirmed"
        )
      ) {
        setError(
          "邮箱还没有验证，请先检查邮箱"
        );
      } else if (
        errorMessage.includes(
          "Password should be at least"
        )
      ) {
        setError(
          "密码至少需要 6 位"
        );
      } else {
        setError(
          errorMessage
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "rgba(0,0,0,0.82)",
        backdropFilter:
          "blur(20px)",
        padding: "20px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px",
          borderRadius: "24px",
          background:
            "linear-gradient(180deg,#151515,#0d0d0d)",
          border:
            "1px solid rgba(255,255,255,0.1)",
          color: "#fff",
          boxShadow:
            "0 30px 100px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "28px",
          }}
        >
          <div
            style={{
              width: "54px",
              height: "54px",
              borderRadius: "16px",
              margin: "0 auto 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "linear-gradient(135deg,#fff,#aaa)",
              color: "#000",
              fontSize: "24px",
              fontWeight: 900,
            }}
          >
            P
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: "26px",
              fontWeight: 800,
            }}
          >
            PawTalk AI
          </h2>

          <p
            style={{
              marginTop: "8px",
              marginBottom: 0,
              color:
                "rgba(255,255,255,0.55)",
              fontSize: "14px",
            }}
          >
            {mode === "login"
              ? "登录你的 PawTalk AI 账号"
              : "创建你的 PawTalk AI 账号"}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            padding: "4px",
            marginBottom: "20px",
            borderRadius: "12px",
            background:
              "rgba(255,255,255,0.05)",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMessage("");
              setError("");
            }}
            style={{
              flex: 1,
              border: 0,
              borderRadius: "9px",
              padding: "10px",
              background:
                mode === "login"
                  ? "#fff"
                  : "transparent",
              color:
                mode === "login"
                  ? "#000"
                  : "#aaa",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            登录
          </button>

          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setMessage("");
              setError("");
            }}
            style={{
              flex: 1,
              border: 0,
              borderRadius: "9px",
              padding: "10px",
              background:
                mode === "signup"
                  ? "#fff"
                  : "transparent",
              color:
                mode === "signup"
                  ? "#000"
                  : "#aaa",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            注册
          </button>
        </div>

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            color:
              "rgba(255,255,255,0.7)",
          }}
        >
          邮箱
        </label>

        <input
          value={email}
          onChange={(event) =>
            setEmail(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter"
            ) {
              submit();
            }
          }}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 15px",
            marginBottom: "14px",
            borderRadius: "12px",
            border:
              "1px solid rgba(255,255,255,0.12)",
            outline: "none",
            background:
              "rgba(255,255,255,0.05)",
            color: "#fff",
            fontSize: "15px",
          }}
        />

        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontSize: "13px",
            color:
              "rgba(255,255,255,0.7)",
          }}
        >
          密码
        </label>

        <input
          value={password}
          onChange={(event) =>
            setPassword(
              event.target.value
            )
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter"
            ) {
              submit();
            }
          }}
          type="password"
          autoComplete={
            mode === "login"
              ? "current-password"
              : "new-password"
          }
          placeholder="至少 6 位"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "14px 15px",
            marginBottom: "16px",
            borderRadius: "12px",
            border:
              "1px solid rgba(255,255,255,0.12)",
            outline: "none",
            background:
              "rgba(255,255,255,0.05)",
            color: "#fff",
            fontSize: "15px",
          }}
        />

        {error && (
          <div
            style={{
              padding: "12px",
              marginBottom: "14px",
              borderRadius: "10px",
              background:
                "rgba(255,70,70,0.1)",
              border:
                "1px solid rgba(255,70,70,0.2)",
              color: "#ff8d8d",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {message && (
          <div
            style={{
              padding: "12px",
              marginBottom: "14px",
              borderRadius: "10px",
              background:
                "rgba(80,200,120,0.1)",
              border:
                "1px solid rgba(80,200,120,0.2)",
              color: "#8ff0ae",
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px",
            border: 0,
            borderRadius: "12px",
            background:
              loading
                ? "#777"
                : "#fff",
            color: "#000",
            fontSize: "15px",
            fontWeight: 800,
            cursor: loading
              ? "not-allowed"
              : "pointer",
          }}
        >
          {loading
            ? "处理中..."
            : mode === "login"
            ? "登录 PawTalk AI"
            : "创建账号"}
        </button>

        <p
          style={{
            marginTop: "18px",
            marginBottom: 0,
            textAlign: "center",
            color:
              "rgba(255,255,255,0.4)",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          登录后即可使用 PawTalk AI
          的免费分析额度。
        </p>
      </div>
    </div>
  );
}
