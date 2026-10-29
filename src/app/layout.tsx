import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARCHVNT",
  icons: { icon: [{ url: "/brand/favicon.png", type: "image/png" }] },
  description:
    "Gestionale per compravendita di abbigliamento vintage e streetwear: lotti, stock, vendite e margini.",
};

export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
