import { Cinzel, Cormorant_Garamond, Manrope } from "next/font/google";

// Declared once and shared by every root layout (site, admin, 404).
// Each non-variable font call uses a single weight to satisfy the Turbopack
// font resolver constraint ("next/font/google queries have exactly one entry").

export const cinzel = Cinzel({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-cinzel",
});

export const cinzelMedium = Cinzel({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  variable: "--font-cinzel-medium",
});

export const cinzelSemibold = Cinzel({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  variable: "--font-cinzel-semibold",
});

export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: "300",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant",
});

export const cormorantNormal = Cormorant_Garamond({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant-normal",
});

export const cormorantMedium = Cormorant_Garamond({
  subsets: ["latin"],
  weight: "500",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-cormorant-medium",
});

export const manrope = Manrope({
  subsets: ["latin"],
  weight: "300",
  display: "swap",
  variable: "--font-manrope",
});

export const manropeNormal = Manrope({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--font-manrope-normal",
});

export const manropeMedium = Manrope({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
  variable: "--font-manrope-medium",
});

export const manropeSemibold = Manrope({
  subsets: ["latin"],
  weight: "600",
  display: "swap",
  variable: "--font-manrope-semibold",
});

// Combined CSS variable string for easy injection into html className.
// The --font-cinzel variable (400) is the canonical one used in CSS.
export const fontVariables = [
  cinzel.variable,
  cinzelMedium.variable,
  cinzelSemibold.variable,
  cormorant.variable,
  cormorantNormal.variable,
  cormorantMedium.variable,
  manrope.variable,
  manropeNormal.variable,
  manropeMedium.variable,
  manropeSemibold.variable,
].join(" ");
