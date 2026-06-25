export function OverviewCards({
  total,
  generated,
  needsReview,
}: {
  total: number;
  generated: number;
  needsReview: number;
}) {
  const cards = [
    { label: "전체 드래프트", value: total, color: "text-text" },
    { label: "생성 완료", value: generated, color: "text-green-400" },
    { label: "검토 필요", value: needsReview, color: "text-yellow-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border-subtle bg-bg-subtle p-6"
        >
          <p className="text-sm text-text-muted">{card.label}</p>
          <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
