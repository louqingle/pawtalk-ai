"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AvatarProps = {
  userId: string;
  email?: string | null;
  avatarUrl?: string | null;
  onUploaded?: (url: string) => void;
};

export default function Avatar({
  userId,
  email,
  avatarUrl,
  onUploaded,
}: AvatarProps) {
  const supabase = createClient();

  const inputRef =
    useRef<HTMLInputElement | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const [error, setError] =
    useState("");

  const handleUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    setError("");

    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("头像不能超过 5MB");
      return;
    }

    try {
      setUploading(true);

      const extension =
        file.name.split(".").pop() ||
        "jpg";

      const filePath =
        `${userId}/avatar-${Date.now()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("avatars")
          .upload(
            filePath,
            file,
            {
              cacheControl: "3600",
              upsert: true,
              contentType: file.type,
            }
          );

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: publicData,
      } =
        supabase.storage
          .from("avatars")
          .getPublicUrl(filePath);

      const publicUrl =
        publicData.publicUrl;

      const {
        error: updateError,
      } =
        await supabase.auth.updateUser({
          data: {
            avatar_url: publicUrl,
          },
        });

      if (updateError) {
        throw updateError;
      }

      onUploaded?.(publicUrl);
    } catch (err: any) {
      console.error(err);

      setError(
        err?.message ||
          "头像上传失败，请重试"
      );
    } finally {
      setUploading(false);

      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const letter =
    email?.charAt(0)?.toUpperCase() ||
    "U";

  return (
    <div className="avatarUpload">
      <button
        type="button"
        className="avatarButton"
        onClick={() =>
          inputRef.current?.click()
        }
        disabled={uploading}
        title="更换头像"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="用户头像"
          />
        ) : (
          <span className="avatarFallback">
            {letter}
          </span>
        )}

        <span className="avatarCamera">
          {uploading ? (
            <Loader2
              size={14}
              className="spin"
            />
          ) : (
            <Camera size={14} />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleUpload}
        hidden
      />

      {error && (
        <span className="avatarError">
          {error}
        </span>
      )}
    </div>
  );
}
