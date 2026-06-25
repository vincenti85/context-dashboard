// app/drafts/[id]/page.tsx — Editor with split view.

import { getDraft, getLatestOutputs } from "../../actions";
import { DraftEditor } from "@/components/DraftEditor";
import { ResultTabs } from "@/components/ResultTabs";
import { GenerationControl } from "@/components/GenerationControl";
import { parseAiOverrides } from "@/lib/export";
import { assembleDocument } from "@/lib/export";
import { notFound } from "next/navigation";

export default async function EditorPage({
  params,
}: {
  params: { id: string };
}) {
  const draftId = parseInt(params.id, 10);
  const draft = await getDraft(draftId);

  if (!draft) notFound();

  const latestResult = await getLatestOutputs(draftId);

  const assembledPackage = latestResult?.output.uploadPackage
    ? assembleDocument(
        latestResult.output.uploadPackage,
        parseAiOverrides(latestResult.output.aiOverrides),
      )
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{draft.title}</h2>
        <GenerationControl draftId={draftId} hasOutput={!!latestResult} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Draft input */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-text-muted">초안</h3>
          <DraftEditor draftId={draftId} initialContent={draft.sourceMarkdown} />
        </div>

        {/* Right: Result tabs */}
        <div>
          <h3 className="mb-3 text-sm font-medium text-text-muted">결과</h3>
          {latestResult ? (
            <ResultTabs
              brief={latestResult.output.contentBrief || ""}
              outline={latestResult.output.outline || ""}
              uploadPackage={assembledPackage || ""}
            />
          ) : (
            <div className="rounded-lg border border-border-subtle bg-bg-subtle p-8 text-center">
              <p className="text-sm text-text-muted">
                아직 생성된 결과가 없습니다.
              </p>
              <p className="mt-1 text-sm text-text-subtle">
                템플릿 생성 버튼을 눌러 시작하세요.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
