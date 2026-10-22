import { PageHeader, PlaceholderCard } from "@/components/PagePlaceholder";

export default function CapiPage() {
  return (
    <>
      <PageHeader
        title="Capi"
        description="Inventario dei singoli capi, dallo stato di controllo alla vendita."
      />
      <PlaceholderCard
        milestone="Milestone 4"
        items={[
          "Codice univoco, marca, categoria, taglia, condizione, foto, lotto di provenienza",
          "Stati: da controllare, da fotografare, pronto, pubblicato, venduto, reso",
          "Prezzo previsto ed effettivo, canale, commissioni, spedizione, ricavo netto",
        ]}
      />
    </>
  );
}
