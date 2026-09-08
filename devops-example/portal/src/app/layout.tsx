import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDT",
  description: "DDT Application",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
