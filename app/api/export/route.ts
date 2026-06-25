// app/api/export/route.ts — Markdown export with assemble-on-read (B2).

import { NextRequest, NextResponse } from "next/server";
import { getLatestOutputs, getDraft } from "@/app/actions";
import { assembleDocument, parseAiOverrides, buildExportFilename } from "@/lib/export";

export async function GET(request: NextRequest) {
  const draftId = parseInt(request.nextUrl.searchParams.get("id") || "0", 10);
  if (!draftId) {
    return NextResponse.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const draft = await getDraft(draftId);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const result = await getLatestOutputs(draftId);
  if (!result || !result.output.uploadPackage) {
    return NextResponse.json({ error: "No output to export" }, { status: 404 });
  }

  // Assemble-on-read: baseline + ai_overrides overlay
  const assembled = assembleDocument(
    result.output.uploadPackage,
    parseAiOverrides(result.output.aiOverrides),
  );

  const date = result.generation.createdAt.toISOString().slice(0, 10);
  const filename = buildExportFilename(draft.title, date);

  return new NextResponse(assembled, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
