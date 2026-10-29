import { redirect } from "next/navigation";
import { ActionForm, Field } from "@/components/form";
import { PageHeader } from "@/components/PagePlaceholder";
import { Section, Tag, formatDate } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { INVITE_STATUS_LABELS, inviteStatus } from "@/lib/team/invites";
import { getMembership } from "@/lib/team/membership";
import { createMemberAccount, inviteMember, promoteMember, removeMember, revokeInvite } from "./actions";

export const metadata = { title: "Collaboratori · ARCHVNT" };

const ROLE_LABELS = { owner: "Titolare", collaborator: "Collaboratore" } as const;

type MemberRow = { user_id: string; email: string; role: keyof typeof ROLE_LABELS; joined_at: string; is_me: boolean };

export default async function CollaboratoriPage() {
  const m = await getMembership();
  if (!m || m.role !== "owner") redirect("/dashboard");

  if (m.legacy) {
    return (
      <>
        <PageHeader title="Collaboratori" description="Chi lavora con te sui dati dell'attività." />
        <p className="rounded-md border border-stone-300 bg-stone-100 p-4 text-sm text-stone-900">
          Il database è ancora nella versione a un solo utente. Per aggiungere collaboratori applica la migrazione
          «attività condivisa» seguendo le istruzioni del README (dopo aver scaricato un backup).
        </p>
      </>
    );
  }

  const supabase = await createClient();
  const [members, invites] = await Promise.all([
    supabase.rpc("list_members"),
    supabase
      .from("business_invites")
      .select("id,email,role,expires_at,accepted_at,revoked_at,created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (members.error || invites.error) throw new Error("Impossibile leggere i collaboratori");

  return (
    <>
      <PageHeader
        title="Collaboratori"
        description={`Attività «${m.businessName}». I titolari hanno tutti i poteri; i collaboratori vedono e modificano tutto ma non eliminano né annullano.`}
      />

      <div className="max-w-3xl space-y-8">
        <Section title="Membri">
          <ul className="divide-y divide-stone-100">
            {((members.data ?? []) as MemberRow[]).map((u) => (
              <li key={u.user_id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-stone-900">
                    {u.email}
                    {u.is_me && <span className="text-stone-500"> (tu)</span>}
                  </p>
                  <p className="text-xs text-stone-500">Dal {formatDate(u.joined_at)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <Tag>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS]}</Tag>
                  {u.role === "collaborator" && (
                    <>
                      <ActionForm
                        action={promoteMember.bind(null, u.user_id)}
                        submitLabel="Rendi titolare"
                        pendingLabel="…"
                        successMessage={null}
                        variant="quiet"
                        confirm={`Rendere titolare ${u.email}? Avrà i tuoi stessi poteri, compreso eliminare.`}
                      />
                      <ActionForm
                        action={removeMember.bind(null, u.user_id)}
                        submitLabel="Rimuovi"
                        pendingLabel="…"
                        successMessage={null}
                        variant="danger"
                        confirm={`Rimuovere ${u.email}? Perde subito l'accesso; i dati che ha inserito restano.`}
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Crea un account"
          description="Inserisci email e password: l'account nasce subito e la persona entra nell'attività, senza passare da Supabase. Comunicale la password di persona."
        >
          <ActionForm action={createMemberAccount} submitLabel="Crea account" pendingLabel="Creazione…" successMessage={null}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Email" name="email" type="email" required placeholder="nome@esempio.it" />
              <Field label="Password (min. 10 caratteri)" name="password" type="password" required />
              <Field
                label="Ruolo"
                name="role"
                as="select"
                defaultValue="collaborator"
                options={[
                  { value: "collaborator", label: "Collaboratore (non elimina)" },
                  { value: "owner", label: "Titolare (tutti i poteri)" },
                ]}
              />
            </div>
          </ActionForm>
        </Section>

        <Section
          title="Invita una persona"
          description="La persona deve già avere un account e accedere con la stessa email. Il link è personale e scade."
        >
          <ActionForm action={inviteMember} submitLabel="Crea invito" pendingLabel="Creazione…" successMessage={null}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Email" name="email" type="email" required placeholder="nome@esempio.it" />
              <Field
                label="Ruolo"
                name="role"
                as="select"
                defaultValue="collaborator"
                options={[
                  { value: "collaborator", label: "Collaboratore (non elimina)" },
                  { value: "owner", label: "Titolare (tutti i poteri)" },
                ]}
              />
              <Field label="Scade tra (giorni)" name="days" type="number" defaultValue="7" />
            </div>
          </ActionForm>
        </Section>

        <Section title="Inviti">
          {(invites.data ?? []).length === 0 ? (
            <p className="text-sm text-stone-600">Nessun invito creato.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {(invites.data ?? []).map((i) => {
                const status = inviteStatus(i);
                return (
                  <li key={i.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{i.email}</p>
                      <p className="text-xs text-stone-500">
                        {ROLE_LABELS[i.role as keyof typeof ROLE_LABELS]} · creato il {formatDate(i.created_at)}
                        {status === "in_attesa" && ` · scade il ${formatDate(i.expires_at)}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Tag>{INVITE_STATUS_LABELS[status]}</Tag>
                      {status === "in_attesa" && (
                        <ActionForm
                          action={revokeInvite.bind(null, i.id)}
                          submitLabel="Revoca"
                          pendingLabel="…"
                          successMessage={null}
                          variant="danger"
                          confirm={`Revocare l'invito a ${i.email}?`}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
