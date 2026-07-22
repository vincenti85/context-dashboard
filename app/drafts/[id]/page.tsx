// app/drafts/[id]/page.tsx — Editor with split view.

import {
  getDraft,
  getLatestOutputs,
  getJobsForDraft,
  getKeywordEvidence,
  getScheduledPosts,
} from "../../actions";
import { DraftEditor } from "@/components/DraftEditor";
import { ResultTabs } from "@/components/ResultTabs";
import { GenerationControl } from "@/components/GenerationControl";
import { PipelineStatus } from "@/components/PipelineStatus";
import { KeywordEvidence } from "@/components/KeywordEvidence";
import { PostsStaging } from "@/components/PostsStaging";
import { YoutubeVideoLink } from "@/components/YoutubeVideoLink";
import { parseAiOverrides } from "@/lib/export";
import { assembleDocument } from "@/lib/export";
import { notFound } from "next/navigation";

export default async function EditorPage({
  params,
}: {
  // Next.js 15: params is a Promise (async dynamic APIs).
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draftId = parseInt(id, 10);
  const draft = await getDraft(draftId);

  if (!draft) notFound();

  const [latestResult, jobs, keywordEvidence, scheduledPosts] = await Promise.all([
    getLatestOutputs(draftId),
    getJobsForDraft(draftId),
    getKeywordEvidence(draftId),
    getScheduledPosts(draftId),
  ]);

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

      <PipelineStatus draftId={draftId} pipelineStatus={draft.pipelineStatus} jobs={jobs} />

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
              extraTabs={[
                {
                  key: "evidence",
                  label: "근거",
                  content: (
                    <KeywordEvidence
                      keyword={keywordEvidence?.keyword}
                      items={keywordEvidence?.items ?? []}
                      titleScores={keywordEvidence?.titleScores}
                    />
                  ),
                },
                {
                  key: "posts",
                  label: "게시 준비",
                  content: (
                    <div className="space-y-4">
                      <YoutubeVideoLink
                        draftId={draftId}
                        currentVideoId={draft.youtubeVideoId}
                      />
                      <PostsStaging posts={scheduledPosts} />
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <div className="rounded-lg border border-border-subtle bg-bg-subtle p-8 text-center">
              <p className="text-sm text-text-muted">
                아직 생성된 결과가 없습니다.
              </p>
              <p className="mt-1 text-sm text-text-subtle">
                초안을 저장하면 자동으로 생성이 시작됩니다.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
