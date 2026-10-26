/** Rimontato a ogni cambio pagina: fa partire l'animazione d'ingresso. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
