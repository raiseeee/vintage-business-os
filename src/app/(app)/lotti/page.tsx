import { PageHeader, PlaceholderCard } from "@/components/PagePlaceholder";

export default function LottiPage() {
  return (
    <>
      <PageHeader
        title="Acquisti e lotti"
        description="Lotti acquistati con fornitore, costo, peso, quantità e spedizione."
      />
      <PlaceholderCard
        milestone="Milestone 4"
        items={[
          "Registrazione lotti con costi di acquisto e spedizione in entrata",
          "Profitto per lotto e per fornitore",
          "Esportazione CSV",
        ]}
      />
    </>
  );
}
