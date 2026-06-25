"use client";

import { useState } from "react";
import { MarkdownPreview } from "./MarkdownPreview";

const TABS = [
  { key: "brief", label: "브리프" },
  { key: "outline", label: "구성안" },
  { key: "uploadPackage", label: "업로드 패키지" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ResultTabs({
  brief,
  outline,
  uploadPackage,
}: {
  brief: string;
  outline: string;
  uploadPackage: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("uploadPackage");

  const content: Record<TabKey, string> = {
    brief,
    outline,
    uploadPackage,
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1 border-b border-border-subtle">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`border-b-2 px-3 py-2 text-sm transition-colors ${
              activeTab === tab.key
                ? "border-accent text-text"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <MarkdownPreview content={content[activeTab]} />
      </div>
    </div>
  );
}
