export function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-stone-600">{description}</p>
    </header>
  );
}

export function PlaceholderCard({
  milestone,
  items,
}: {
  milestone: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-6">
      <p className="text-sm font-medium text-stone-900">
        Non ancora implementato — previsto in {milestone}
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}
