import { PageHeader, PlaceholderCard } from "@/components/PagePlaceholder";

export default function CrmPage() {
  return (
    <>
      <PageHeader
        title="CRM fornitori"
        description="Stato dei contatti, note, prossime azioni e storico valutazioni."
      />
      <PlaceholderCard
        milestone="Milestone 5"
        items={[
          "Stati: da contattare → contattata → in attesa → risposta ricevuta → campione richiesto → verificata / scartata",
          "Note, date dei contatti e prossima azione",
          "Storico delle valutazioni",
        ]}
      />
    </>
  );
}
