import { PageHeader, PlaceholderCard } from "@/components/PagePlaceholder";

export default function FornitoriPage() {
  return (
    <>
      <PageHeader
        title="Supplier Finder"
        description="Anagrafica fornitori con fonti verificabili e punteggio trasparente."
      />
      <PlaceholderCard
        milestone="Milestone 3"
        items={[
          "Anagrafica: nome, sito, paese, contatti, MOQ, prezzi, note",
          "Tipo: raccoglitore diretto, centro di selezione, grossista documentato, rivenditore, origine non verificata",
          "Fonti per ogni informazione, separando fatti, dichiarazioni e ipotesi",
          "Punteggio trasparente e blocco dell'etichetta «diretto» senza prove",
        ]}
      />
    </>
  );
}
