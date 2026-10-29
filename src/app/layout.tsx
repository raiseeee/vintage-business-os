import type { Metadata, Viewport } from "next";
import { APP_COLOR } from "@/lib/pwa";
import "./globals.css";

export const metadata: Metadata = {
  title: "ARCHVNT",
  appleWebApp: { capable: true, title: "ARCHVNT", statusBarStyle: "black" },
  icons: { icon: [{ url: "/brand/favicon.png", type: "image/png" }] },
  description:
    "Gestionale per compravendita di abbigliamento vintage e streetwear: lotti, stock, vendite e margini.",
};

export const viewport: Viewport = { viewportFit: "cover", themeColor: APP_COLOR };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="it" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
