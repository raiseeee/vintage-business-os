import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/form";
import { ExternalLink, Section, SupplierTypeBadge, Tag, formatDate } from "@/components/ui";
import { formatEuro } from "@/lib/metrics";
import {
  CLAIM_FIELDS,
  CLAIM_FIELD_LABELS,
  CONTACT_STATUS_LABELS,
  EVIDENCE_HINTS,
  EVIDENCE_LABELS,
  EVIDENCE_LEVELS,
  type EvidenceLevel,
} from "@/lib/suppliers/constants";
import { getSupplierDetail } from "@/lib/suppliers/queries";
import { uuidSchema } from "@/lib/suppliers/schemas";
import {
  SCORE_HINTS,
  SCORE_LABELS,
  SCORE_WEIGHTS,
  computeScore,
  type ScoreKey,
} from "@/lib/suppliers/score";
import {
  addClaim,
  addEvaluation,
  addSource,
  deleteClaim,
  deleteSource,
  updateSupplier,
} from "../actions";
import { SupplierForm } from "../SupplierForm";

export const metadata = { title: "Fornitore · Vintage Business OS" };

const EVIDENCE_STYLES: Record<EvidenceLevel, string> = {
  documentato: "border-green-200 bg-green-50",
  dichiarato: "border-amber-200 bg-amber-50",
  ipotesi: "border-stone-200 bg-stone-50",
};

const scoreOptions = [0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }));

export default async function FornitoreDetailPage(props: PageProps<"/fornitori/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const detail = await getSupplierDetail(id);
  if (!detail) notFound();
  const { supplier, sources, claims, evaluations, score } = detail;

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const sourceOptions = [
    { value: "", label: "— nessuna fonte —" },
    ...sources.map((s) => ({ value: s.id, label: s.title })),
  ];

  const moq = [
    supplier.min_order_qty !== null && `${supplier.min_order_qty} capi`,
    supplier.min_order_weight_kg !== null && `${supplier.min_order_weight_kg} kg`,
    supplier.min_order_value_cents !== null && formatEuro(supplier.min_order_value_cents),
  ].filter(Boolean);

  return (
    <>
      <Link href="/fornitori" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">
        ← Tutti i fornitori
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">{supplier.name}</h1>
          <SupplierTypeBadge type={supplier.supplier_type} />
          {supplier.is_demo && <Tag>DEMO</Tag>}
        </div>
        <p className="mt-1 text-sm text-stone-600">
          {[supplier.country, CONTACT_STATUS_LABELS[supplier.contact_status]].filter(Boolean).join(" · ")}
          {supplier.website && (
            <>
              {" · "}
              <ExternalLink href={supplier.website}>{supplier.website.replace(/^https?:\/\//, "")}</ExternalLink>
            </>
          )}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Punteggio"
          description="Calcolato dall'ultima valutazione. Ogni criterio vale 0-5 e pesa una percentuale fissa."
        >
          {score ? (
            <>
              <p className="text-3xl font-semibold tabular-nums text-stone-900">
                {score.total}
                <span className="text-base font-normal text-stone-500">/100</span>
              </p>
              <table className="mt-3 w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-1 text-left font-medium">Criterio</th>
                    <th className="py-1 text-right font-medium">Voto</th>
                    <th className="py-1 text-right font-medium">Peso</th>
                    <th className="py-1 text-right font-medium">Punti</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {score.criteria.map((c) => (
                    <tr key={c.key}>
                      <td className="py-1.5 text-stone-800">{c.label}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {c.effective !== c.raw ? (
                          <span title={`Voto inserito ${c.raw}, limitato dal tipo di fornitore`}>
                            <s className="text-stone-400">{c.raw}</s> {c.effective}
                          </span>
                        ) : (
                          c.raw
                        )}
                        /5
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-stone-600">{c.weight}%</td>
                      <td className="py-1.5 text-right tabular-nums font-medium">{c.points.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {score.notes.map((n) => (
                <p key={n} className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{n}</p>
              ))}
            </>
          ) : (
            <p className="text-sm text-stone-600">Nessuna valutazione: aggiungine una più in basso per ottenere il punteggio.</p>
          )}
        </Section>

        <Section title="Scheda">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-stone-500">Ordine minimo</dt>
            <dd>{moq.length ? moq.join(" · ") : "—"}</dd>
            <dt className="text-stone-500">Prezzo al kg</dt>
            <dd>{supplier.price_per_kg_cents !== null ? formatEuro(supplier.price_per_kg_cents) : "—"}</dd>
            <dt className="text-stone-500">Lingue</dt>
            <dd className="flex flex-wrap gap-1">{supplier.languages.length ? supplier.languages.map((l) => <Tag key={l}>{l}</Tag>) : "—"}</dd>
            <dt className="text-stone-500">Stock</dt>
            <dd className="flex flex-wrap gap-1">{supplier.stock_types.length ? supplier.stock_types.map((l) => <Tag key={l}>{l}</Tag>) : "—"}</dd>
            <dt className="text-stone-500">Marchi</dt>
            <dd className="flex flex-wrap gap-1">{supplier.brands.length ? supplier.brands.map((l) => <Tag key={l}>{l}</Tag>) : "—"}</dd>
            <dt className="text-stone-500">Referente</dt>
            <dd>{supplier.contact_name ?? "—"}</dd>
            <dt className="text-stone-500">Email</dt>
            <dd>{supplier.contact_email ?? "—"}</dd>
            <dt className="text-stone-500">Telefono</dt>
            <dd>{supplier.contact_phone ?? "—"}</dd>
          </dl>
          {supplier.price_notes && <p className="mt-3 whitespace-pre-wrap text-sm text-stone-700">{supplier.price_notes}</p>}
          {supplier.notes && <p className="mt-3 whitespace-pre-wrap border-t border-stone-100 pt-3 text-sm text-stone-700">{supplier.notes}</p>}
        </Section>
      </div>

      <div className="mt-5 space-y-5">
        <Section
          title="Informazioni e livello di prova"
          description="Ogni informazione dice quanto è affidabile. Solo quelle documentate poggiano su una fonte registrata."
        >
          <div className="space-y-4">
            {EVIDENCE_LEVELS.map((level) => {
              const items = claims.filter((c) => c.evidence_level === level);
              return (
                <div key={level} className={`rounded-md border p-4 ${EVIDENCE_STYLES[level]}`}>
                  <h3 className="text-sm font-semibold text-stone-900">
                    {EVIDENCE_LABELS[level]} <span className="font-normal text-stone-500">({items.length})</span>
                  </h3>
                  <p className="text-xs text-stone-600">{EVIDENCE_HINTS[level]}</p>
                  {items.length === 0 ? (
                    <p className="mt-2 text-sm text-stone-500">Nessuna informazione.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {items.map((c) => {
                        const src = c.source_id ? sourceById.get(c.source_id) : undefined;
                        return (
                          <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                            <div>
                              <span className="font-medium text-stone-800">{CLAIM_FIELD_LABELS[c.field]}:</span>{" "}
                              <span className="whitespace-pre-wrap text-stone-800">{c.statement}</span>
                              {src && (
                                <span className="block text-xs text-stone-600">
                                  Fonte: <ExternalLink href={src.url}>{src.title}</ExternalLink>
                                </span>
                              )}
                            </div>
                            <ActionForm
                              action={deleteClaim.bind(null, supplier.id, c.id)}
                              submitLabel="Elimina"
                              pendingLabel="…"
                              successMessage={null}
                              variant="danger"
                              confirm="Eliminare questa informazione?"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          <h3 className="mt-6 text-sm font-semibold text-stone-900">Aggiungi un&apos;informazione</h3>
          <ActionForm action={addClaim.bind(null, supplier.id)} submitLabel="Aggiungi informazione" successMessage="Informazione aggiunta." className="mt-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field as="select" label="Argomento" name="field" defaultValue="provenienza" options={CLAIM_FIELDS.map((f) => ({ value: f, label: CLAIM_FIELD_LABELS[f] }))} />
              <Field as="select" label="Livello di prova" name="evidence_level" defaultValue="dichiarato" options={EVIDENCE_LEVELS.map((l) => ({ value: l, label: EVIDENCE_LABELS[l] }))} />
              <Field as="select" label="Fonte" name="source_id" options={sourceOptions} hint={sources.length === 0 ? "Aggiungi prima una fonte per poter documentare." : "Obbligatoria se «Documentato»."} />
            </div>
            <Field as="textarea" label="Informazione" name="statement" rows={2} />
          </ActionForm>
        </Section>

        <Section title="Fonti" description="Pagine, documenti o conversazioni che supportano le informazioni.">
          {sources.length === 0 ? (
            <p className="text-sm text-stone-500">Nessuna fonte registrata.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {sources.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-stone-800">
                      <ExternalLink href={s.url}>{s.title}</ExternalLink>
                    </p>
                    <p className="text-xs text-stone-500">
                      {s.url ?? "senza indirizzo"} · consultata il {formatDate(s.retrieved_at)}
                    </p>
                    {s.note && <p className="text-xs text-stone-600">{s.note}</p>}
                  </div>
                  <ActionForm
                    action={deleteSource.bind(null, supplier.id, s.id)}
                    submitLabel="Elimina"
                    pendingLabel="…"
                    successMessage={null}
                    variant="danger"
                    confirm="Eliminare questa fonte?"
                  />
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold text-stone-900">Aggiungi una fonte</h3>
          <ActionForm action={addSource.bind(null, supplier.id)} submitLabel="Aggiungi fonte" successMessage="Fonte aggiunta." className="mt-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Titolo" name="title" required placeholder="Pagina «Chi siamo»" />
              <Field label="Indirizzo web" name="url" placeholder="https://…" />
              <Field label="Data consultazione" name="retrieved_at" type="date" />
            </div>
            <Field as="textarea" label="Nota" name="note" rows={2} />
          </ActionForm>
        </Section>

        <Section title="Valutazioni" description="Storico: conta l'ultima. Ogni valutazione si aggiunge, non si sovrascrive.">
          {evaluations.length === 0 ? (
            <p className="text-sm text-stone-500">Nessuna valutazione.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {evaluations.map((e, i) => {
                const result = computeScore(e, supplier.supplier_type);
                return (
                  <li key={e.id} className="py-2 text-sm">
                    <p className="text-stone-800">
                      <span className="font-semibold tabular-nums">{result.total}/100</span>{" "}
                      <span className="text-stone-500">· {formatDate(e.created_at)}{i === 0 && " · attuale"}</span>
                    </p>
                    <p className="text-xs text-stone-500">
                      {(Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((k) => `${SCORE_LABELS[k]} ${e[k]}`).join(" · ")}
                    </p>
                    {e.comment && <p className="text-xs text-stone-700">{e.comment}</p>}
                  </li>
                );
              })}
            </ul>
          )}

          <h3 className="mt-6 text-sm font-semibold text-stone-900">Nuova valutazione</h3>
          <ActionForm action={addEvaluation.bind(null, supplier.id)} submitLabel="Salva valutazione" successMessage="Valutazione salvata." className="mt-2 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((k) => (
                <Field key={k} as="select" label={`${SCORE_LABELS[k]} (peso ${SCORE_WEIGHTS[k]}%)`} name={k} options={scoreOptions} defaultValue="3" hint={SCORE_HINTS[k]} />
              ))}
            </div>
            <Field as="textarea" label="Commento" name="comment" rows={2} />
          </ActionForm>
        </Section>

        <Section title="Modifica scheda">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-stone-700 hover:text-stone-900">
              Apri il modulo di modifica
            </summary>
            <div className="mt-4">
              <SupplierForm action={updateSupplier.bind(null, supplier.id)} supplier={supplier} submitLabel="Salva modifiche" />
            </div>
          </details>
        </Section>
      </div>
    </>
  );
}
