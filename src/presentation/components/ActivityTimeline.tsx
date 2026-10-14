export function ActivityTimeline({ items }: { items: Array<{ id: string; at: string; text: string }> }) {
  if (items.length === 0) {
    return <p className="text-base text-muted-foreground">No accountability activity yet.</p>;
  }
  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="border-l-4 border-border pl-3">
          <p className="font-semibold">{item.text}</p>
          <p className="text-sm text-muted-foreground">{item.at}</p>
        </li>
      ))}
    </ol>
  );
}
