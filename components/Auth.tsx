"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, LogIn, UserPlus, X } from "lucide-react";

type AuthProps = {
  onClose?: () => void;
};

export default function Auth({
  onClose,
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

  const [message, setMessage] =
    useState("");

  const [error, setError] =
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
      if (mode === "login") {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        window.location.reload();
      } else {
        const { data, error } =
          await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

        if (error) {
          throw error;
        }

        if (data.session) {
          window.location.reload();
        } else {
          setMessage(
            "注册成功！请检查邮箱并点击验证链接。"
          );
        }
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
    <div
      className="authOverlay"
      onClick={onClose}
    >
      <div
        className="authCard"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        {onClose && (
          <button
            className="authClose"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        )}

        <div className="authLogo">
          🐾
        </div>

        <h2>
          {mode === "login"
            ? "登录 PawTalk AI"
            : "创建 PawTalk 账号"}
        </h2>

        <p>
          {mode === "login"
            ? "登录后使用你的免费分析额度"
            : "注册即可获得 5 次免费分析"}
        </p>

        <div className="authInput">
          <Mail size={18} />

          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            autoComplete="email"
          />
        </div>

        <div className="authInput">
          <Lock size={18} />

          <input
            type="password"
            placeholder="密码（至少 6 位）"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submit();
              }
            }}
            autoComplete={
              mode === "login"
                ? "current-password"
                : "new-password"
            }
          />
        </div>

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
          className="authSubmit"
          onClick={submit}
          disabled={loading}
        >
          {mode === "login" ? (
            <LogIn size={18} />
          ) : (
            <UserPlus size={18} />
          )}

          {loading
            ? "处理中..."
            : mode === "login"
            ? "登录"
            : "注册"}
        </button>

        <button
          className="authSwitch"
          onClick={() => {
            setError("");
            setMessage("");

            setMode(
              mode === "login"
                ? "register"
                : "login"
            );
          }}
        >
          {mode === "login"
            ? "还没有账号？立即注册"
            : "已经有账号？立即登录"}
        </button>
      </div>
    </div>
  );
}
