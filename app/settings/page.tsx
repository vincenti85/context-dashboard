// app/settings/page.tsx — Channel profile settings (M8).

import { getChannelProfile } from "../actions";
import { ChannelProfileForm } from "@/components/ChannelProfileForm";

export default async function SettingsPage() {
  const profile = await getChannelProfile();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">채널 설정</h2>
        <p className="mt-1 text-sm text-text-muted">
          여기서 저장한 정보는 모든 자동 생성 프롬프트에 컨텍스트로 포함됩니다.
        </p>
      </div>
      <ChannelProfileForm initial={profile} />
    </div>
  );
}
