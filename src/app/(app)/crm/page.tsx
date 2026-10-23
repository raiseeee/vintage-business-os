import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { Tag, formatDate } from "@/components/ui";
import { todayIso } from "@/lib/dates";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS } from "@/lib/suppliers/constants";
import { listCrmRows } from "@/lib/suppliers/queries";

export const metadata = { title: "CRM fornitori · Vintage Business OS" };

export default async function CrmPage() {
  const rows = await listCrmRows();
  const today = todayIso();

  // Prossime azioni: solo fornitori ancora "vivi", ordinati per scadenza (senza data in fondo).
  const actions = rows
    .filter((r) => r.next_action && r.contact_status !== "scartata")
    .sort((a, b) => (a.next_action_date ?? "9999").localeCompare(b.next_action_date ?? "9999"));

  return (
    <>
      <PageHeader
        title="CRM fornitori"
        description="Stato dei contatti, prossime azioni e ultimo contatto. Si modificano dalla scheda del fornitore."
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-700">
          Nessun fornitore. <Link href="/fornitori?nuovo=1" className="font-medium text-stone-900 underline">Aggiungine uno</Link> per iniziare a tracciare i contatti.
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-base font-semibold text-stone-900">Prossime azioni</h2>
            {actions.length === 0 ? (
              <p className="text-sm text-stone-500">Nessuna azione pianificata. Aggiungila dalla sezione CRM della scheda fornitore.</p>
            ) : (
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
                {actions.map((r) => {
                  const overdue = r.next_action_date !== null && r.next_action_date < today;
                  return (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                      <div>
                        <Link href={`/fornitori/${r.id}`} className="font-medium text-stone-900 hover:underline">{r.name}</Link>
                        <p className="text-stone-700">{r.next_action}</p>
                      </div>
                      <span className={overdue ? "font-medium text-red-800" : "text-stone-600"}>
                        {r.next_action_date ? `${overdue ? "Scaduta · " : ""}${formatDate(r.next_action_date)}` : "senza data"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-stone-900">Pipeline</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {CONTACT_STATUSES.map((status) => {
                const group = rows.filter((r) => r.contact_status === status);
                return (
                  <div key={status} className="rounded-lg border border-stone-200 bg-white">
                    <h3 className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                      {CONTACT_STATUS_LABELS[status]} ({group.length})
                    </h3>
                    {group.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-stone-400">—</p>
                    ) : (
                      <ul className="divide-y divide-stone-100">
                        {group.map((r) => (
                          <li key={r.id} className="px-4 py-2 text-sm">
                            <Link href={`/fornitori/${r.id}`} className="font-medium text-stone-900 hover:underline">{r.name}</Link>
                            {r.is_demo && <> <Tag>DEMO</Tag></>}
                            <p className="text-xs text-stone-500">
                              {[r.country, r.lastContactAt ? `ultimo contatto ${formatDate(r.lastContactAt)}` : "mai contattato"].filter(Boolean).join(" · ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </>
  );
}
