import type { MetadataRoute } from "next";
import { getSiteStatus, mediaSrc } from "@/lib/content";

/** Lets "Add to Home Screen" show the right name and mark. Not a PWA. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // The favicon chosen in the admin's Settings, else the shipped one.
  const favicon = (await getSiteStatus()).brand?.favicon;
  return {
    name: "Enzo Interiors",
    short_name: "Enzo",
    description: "Bespoke fitted kitchens, bedrooms, wardrobes and media walls, made in Leicester.",
    start_url: "/",
    display: "browser",
    background_color: "#F2F0EB",
    theme_color: "#102E2D",
    icons: [
      favicon
        ? { src: mediaSrc(favicon), sizes: "512x512" }
        : { src: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
