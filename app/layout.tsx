import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Qaitar — защита прав потребителей",
  description: "Загрузите доказательства и получите конкретный следующий шаг по закону Казахстана.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
