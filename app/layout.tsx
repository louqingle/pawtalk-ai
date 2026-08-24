import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PawTalk AI V2 · 宠物情绪分析器",
  description: "用声音和照片观察宠物的情绪与行为线索。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
