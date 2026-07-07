// lib/youtube/metadata.ts — Apply title/description/tags to a published video (S1).
// SAFETY: this must only ever be called from a manual, admin-approved action
// (the "메타데이터 적용" button — see components/PostsStaging.tsx / app/actions.ts).
// It must NEVER be called from an automatic pipeline job — grep guard:
//   grep -r "applyMetadata" lib/jobs/  ->  must return 0 matches (WP9-V2).

import { ytOAuth } from "./client";

export interface ApplyMetadataInput {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
}

export async function applyMetadata(input: ApplyMetadataInput): Promise<void> {
  await ytOAuth("videos?part=snippet", {
    method: "PUT",
    body: JSON.stringify({
      id: input.videoId,
      snippet: {
        title: input.title,
        description: input.description,
        tags: input.tags,
        categoryId: "27", // Education — matches this channel's content type; adjust in UI if needed later
      },
    }),
  });
}
