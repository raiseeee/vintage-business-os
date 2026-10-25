import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vintage Business OS",
  description:
    "Gestionale per compravendita di abbigliamento vintage e streetwear: lotti, stock, vendite e margini.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
