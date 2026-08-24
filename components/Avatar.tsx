"use client";

type AvatarProps = {
  src?: string;
  alt?: string;
  size?: number;
  className?: string;
};

export default function Avatar({
  src,
  alt = "Avatar",
  size = 40,
  className = "",
}: AvatarProps) {
  return (
    <div
      className={`overflow-hidden rounded-full bg-gray-800 flex items-center justify-center ${className}`}
      style={{
        width: size,
        height: size,
      }}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <span
          className="text-white font-semibold"
          style={{
            fontSize: Math.max(
              12,
              size * 0.4
            ),
          }}
        >
          🐾
        </span>
      )}
    </div>
  );
}
