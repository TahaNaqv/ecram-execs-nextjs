import { Cinzel, Cormorant_Garamond, Manrope } from "next/font/google";

// Declared once and shared by every root layout (site, admin, 404).
export const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-cinzel" });
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
});
export const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-manrope" });

export const fontVariables = `${cinzel.variable} ${cormorant.variable} ${manrope.variable}`;
