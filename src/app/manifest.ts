import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes the app installable from Safari (iPhone:
 * Share → Add to Home Screen) and Chrome / Samsung Internet
 * (Install app). Deliberately static: the manifest must never
 * depend on the database, so `next build` works without one.
 * Maskable icons keep the logo inside Android's squircle/circle
 * masks (Samsung One UI crops aggressively).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HydroMart Shop",
    short_name: "HydroMart",
    description: "Sales & stock for HydroMart Shop",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f8fa",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
