"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "개요" },
  { href: "/drafts", label: "드래프트" },
  { href: "/settings", label: "설정" },
];

export function DashboardNav() {
  const pathname = usePathname();

  // Don't show nav on login page
  if (pathname === "/login") return null;

  return (
    <nav className="w-56 border-r border-border-subtle bg-bg-subtle p-4">
      <div className="mb-8">
        <h1 className="text-sm font-semibold text-text">콘텐츠 대시보드</h1>
      </div>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-bg-elevated text-text"
                    : "text-text-muted hover:text-text hover:bg-bg-elevated"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
