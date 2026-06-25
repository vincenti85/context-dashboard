// app/layout.tsx — Root layout with Tailwind.

import type { Metadata } from "next";
// Force dynamic rendering (all pages need DB access at runtime)
export const dynamic = "force-dynamic";
import "./globals.css";
import { DashboardNav } from "@/components/DashboardNav";

export const metadata: Metadata = {
  title: "콘텐츠 대시보드",
  description: "콘텐츠 패키지 생성 관리 도구",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-bg text-text">
        <div className="flex min-h-screen">
          <DashboardNav />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
