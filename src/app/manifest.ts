import type { MetadataRoute } from "next";
import { APP_COLOR } from "@/lib/pwa";

// Rende il sito installabile come app: icona sulla Home, schermo intero, niente barra dell'indirizzo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARCHVNT",
    short_name: "ARCHVNT",
    description: "Gestionale per compravendita di abbigliamento vintage e streetwear.",
    lang: "it",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: APP_COLOR,
    theme_color: APP_COLOR,
    icons: [
      { src: "/brand/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/brand/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
