import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TicketBox Audience",
  description: "Khám phá những sự kiện đang mở bán trên TicketBox.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
