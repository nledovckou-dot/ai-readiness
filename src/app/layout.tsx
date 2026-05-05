import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Готовность дилерского центра к ИИ — за 7 минут",
  description:
    "Один процесс, три оси, понятный балл. Без воды, без презентаций, без «давайте обсудим».",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
