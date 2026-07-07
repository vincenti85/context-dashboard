"use client";

import { useState, type ReactNode } from "react";
import { MarkdownPreview } from "./MarkdownPreview";

const BUILTIN_TABS = [
  { key: "brief", label: "브리프" },
  { key: "outline", label: "구성안" },
  { key: "uploadPackage", label: "업로드 패키지" },
] as const;

type BuiltinTabKey = (typeof BUILTIN_TABS)[number]["key"];

export interface ExtraTab {
  key: string;
  label: string;
  content: ReactNode;
}

export function ResultTabs({
  brief,
  outline,
  uploadPackage,
  extraTabs = [],
}: {
  brief: string;
  outline: string;
  uploadPackage: string;
  /** Non-markdown tabs appended after the built-in ones (e.g. 근거, 게시 준비 — WP7). */
  extraTabs?: ExtraTab[];
}) {
  const [activeTab, setActiveTab] = useState<string>("uploadPackage");

  const builtinContent: Record<BuiltinTabKey, string> = {
    brief,
    outline,
    uploadPackage,
  };

  const allTabs = [
    ...BUILTIN_TABS.map((t) => ({ key: t.key as string, label: t.label })),
    ...extraTabs.map((t) => ({ key: t.key, label: t.label })),
  ];

  const extraByKey = new Map(extraTabs.map((t) => [t.key, t.content]));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1 border-b border-border-subtle">
        {allTabs.map((tab) => (
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
        {activeTab in builtinContent ? (
          <MarkdownPreview content={builtinContent[activeTab as BuiltinTabKey]} />
        ) : (
          extraByKey.get(activeTab)
        )}
      </div>
    </div>
  );
}
