export function MarkdownPreview({ content }: { content: string }) {
  return (
    <pre className="whitespace-pre-wrap break-words rounded-md border border-border-subtle bg-bg-subtle p-4 font-mono-md text-text-muted">
      {content}
    </pre>
  );
}
