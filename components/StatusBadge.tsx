const STATUS_STYLES: Record<string, string> = {
  draft: "bg-gray-800 text-gray-400",
  generated: "bg-blue-900 text-blue-300",
  reviewed: "bg-yellow-900 text-yellow-300",
  ready: "bg-green-900 text-green-300",
  archived: "bg-gray-900 text-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "초안",
  generated: "생성됨",
  reviewed: "검토됨",
  ready: "완료",
  archived: "보관됨",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const label = STATUS_LABELS[status] || status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {label}
    </span>
  );
}
