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
    useState<"login" | "register">("login");

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const submit = async () => {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }

    if (password.length < 6) {
      setError("密码至少需要 6 位");
      return;
    }

    setLoading(true);

    try {
      if (mode === "register") {
        const { data, error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          onSuccess?.();
        } else {
          setMessage(
            "注册成功，请检查邮箱完成验证后再登录。"
          );
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        onSuccess?.();
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "操作失败，请稍后重试"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authBox">
      <div className="authTabs">
        <button
          className={
            mode === "login"
              ? "active"
              : ""
          }
          onClick={() => {
            setMode("login");
            setError("");
            setMessage("");
          }}
        >
          登录
        </button>

        <button
          className={
            mode === "register"
              ? "active"
              : ""
          }
          onClick={() => {
            setMode("register");
            setError("");
            setMessage("");
          }}
        >
          注册
        </button>
      </div>

      <h2>
        {mode === "login"
          ? "登录 PawTalk AI"
          : "创建 PawTalk 账号"}
      </h2>

      <p>
        {mode === "login"
          ? "登录后即可使用你的免费分析额度。"
          : "注册即可获得 5 次免费分析。"}
      </p>

      <input
        type="email"
        placeholder="邮箱"
        value={email}
        onChange={(e) =>
          setEmail(e.target.value)
        }
        autoComplete="email"
      />

      <input
        type="password"
        placeholder="密码（至少 6 位）"
        value={password}
        onChange={(e) =>
          setPassword(e.target.value)
        }
        autoComplete={
          mode === "login"
            ? "current-password"
            : "new-password"
        }
      />

      {error && (
        <div className="authError">
          {error}
        </div>
      )}

      {message && (
        <div className="authMessage">
          {message}
        </div>
      )}

      <button
        className="primary authSubmit"
        onClick={submit}
        disabled={loading}
      >
        {loading
          ? "处理中..."
          : mode === "login"
          ? "登录"
          : "注册"}
      </button>

      <button
        className="authSwitch"
        onClick={() => {
          setMode(
            mode === "login"
              ? "register"
              : "login"
          );
          setError("");
          setMessage("");
        }}
      >
        {mode === "login"
          ? "还没有账号？立即注册"
          : "已经有账号？立即登录"}
      </button>
    </div>
  );
}
