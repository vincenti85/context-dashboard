"use client";

import { useState } from "react";
import { updateChannelProfile } from "@/app/actions";

interface ChannelProfileData {
  channelName: string;
  channelDescription: string;
  defaultAudience: string;
  toneGuide: string | null;
  benchmarkChannelIds: string[] | null;
}

/** /settings — single-row channel profile, injected into every AI prompt (M8). */
export function ChannelProfileForm({ initial }: { initial: ChannelProfileData | null }) {
  const [channelName, setChannelName] = useState(initial?.channelName ?? "");
  const [channelDescription, setChannelDescription] = useState(initial?.channelDescription ?? "");
  const [defaultAudience, setDefaultAudience] = useState(initial?.defaultAudience ?? "");
  const [toneGuide, setToneGuide] = useState(initial?.toneGuide ?? "");
  const [benchmarkChannelIds, setBenchmarkChannelIds] = useState(
    (initial?.benchmarkChannelIds ?? []).join(", "),
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateChannelProfile({
        channelName: channelName.trim(),
        channelDescription: channelDescription.trim(),
        defaultAudience: defaultAudience.trim(),
        toneGuide: toneGuide.trim() || undefined,
        benchmarkChannelIds: benchmarkChannelIds
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const canSave = channelName.trim() && channelDescription.trim() && defaultAudience.trim();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <label className="mb-1 block text-sm text-text-muted">채널 이름</label>
        <input
          type="text"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          placeholder="예: 클로드코드 실전 가이드"
          className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-muted">채널 소개 / 방향</label>
        <textarea
          value={channelDescription}
          onChange={(e) => setChannelDescription(e.target.value)}
          rows={3}
          placeholder="이 채널이 다루는 주제와 지향점을 설명하세요"
          className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-muted">기본 타겟 시청자</label>
        <input
          type="text"
          value={defaultAudience}
          onChange={(e) => setDefaultAudience(e.target.value)}
          placeholder="예: Claude Code를 배우고 싶은 비개발자, 1인 기업"
          className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-muted">톤 / 금지어 (선택)</label>
        <input
          type="text"
          value={toneGuide}
          onChange={(e) => setToneGuide(e.target.value)}
          placeholder="예: 과장된 표현 금지, 친근한 존댓말"
          className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-muted">
          벤치마크 채널 ID (쉼표로 구분, 선택 — S4 아웃라이어 수집용)
        </label>
        <input
          type="text"
          value={benchmarkChannelIds}
          onChange={(e) => setBenchmarkChannelIds(e.target.value)}
          placeholder="UCxxxxxxxx, UCyyyyyyyy"
          className="w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!canSave || saving}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {saved && <span className="text-sm text-green-400">저장되었습니다</span>}
      </div>
    </div>
  );
}
