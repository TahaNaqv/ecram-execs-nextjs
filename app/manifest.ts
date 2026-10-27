import type { MetadataRoute } from "next";
import { siteTheme, themeColor } from "@/lib/site-theme";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ecram Execs",
    short_name: "Ecram Execs",
    description: "The art of executive hospitality — executive chauffeur services throughout the Netherlands.",
    start_url: "/",
    display: "browser",
    background_color: themeColor[siteTheme],
    theme_color: themeColor[siteTheme],
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
