import { PageHeader } from "@/components/PagePlaceholder";
import { Calculator } from "./Calculator";

export const metadata = { title: "Calcolatore · Vintage Business OS" };

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CalcolatorePage(props: PageProps<"/calcolatore">) {
  const params = await props.searchParams;
  // Valori iniziali dal link «Calcola» di un capo (acquisto e prezzo previsto): solo testo, si possono cambiare.
  const initial = {
    purchase: pick(params.acquisto).slice(0, 12),
    salePrice: pick(params.vendita).slice(0, 12),
  };

  return (
    <>
      <PageHeader
        title="Calcolatore di redditività"
        description="Quanto guadagni su un capo, con le formule in chiaro, e a che prezzo minimo non vai in perdita."
      />
      <Calculator initial={initial} />
    </>
  );
}
