import type { MetadataRoute } from "next";

/** Lets "Add to Home Screen" show the right name and mark. Not a PWA. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Enzo Interiors",
    short_name: "Enzo",
    description: "Bespoke fitted kitchens, bedrooms, wardrobes and media walls, made in Leicester.",
    start_url: "/",
    display: "browser",
    background_color: "#F2F0EB",
    theme_color: "#102E2D",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
