import Image from "next/image";

/** Logo ARCHVNT. «bianco» per i fondi scuri, «scuro» per i fondi chiari. */
export function Logo({
  tone = "scuro",
  variant = "completo",
  className = "",
  width,
}: {
  tone?: "scuro" | "bianco";
  variant?: "completo" | "simbolo";
  className?: string;
  width: number;
}) {
  const full = variant === "completo";
  const src = `/brand/archvnt-${full ? "logo" : "simbolo"}-${tone}.png`;
  // Proporzioni dei file originali: logo 942×729, simbolo 913×550.
  const ratio = full ? 729 / 942 : 550 / 913;
  return (
    <Image
      src={src}
      alt="ARCHVNT"
      width={width}
      height={Math.round(width * ratio)}
      priority
      className={className}
    />
  );
}
