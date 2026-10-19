import type en from "./dictionaries/en.json";

/**
 * The English dictionary is the source of truth for the shape. Every other locale is
 * loaded through this type, so a missing or misspelled key fails `npm run typecheck`
 * rather than rendering `undefined` to a visitor.
 */
export type Dictionary = typeof en;
