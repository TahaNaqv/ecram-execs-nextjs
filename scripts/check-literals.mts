// Flags user-facing prose left hardcoded in a component instead of moving to the dictionaries.
// Run in CI next to check-translations.mts:  node scripts/check-literals.mts
//
// This is a lint, not a parser: it looks for JSX text nodes and localizable attributes whose
// value is a plain English-looking string. Anything it is wrong about goes in ALLOW below, with
// a reason — an allowlist entry is a decision, not a silencer.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["app", "lib/i18n"];
/** Attributes whose value a visitor can see or hear. */
const ATTRS = ["title", "label", "description", "placeholder", "aria-label", "alt", "hint", "pendingText"];

const ALLOW: RegExp[] = [
  /^ECRAM EXECS$/,                 // brand wordmark
  /^Ecram Execs/,                  // brand name in metadata titles
  /^[A-Z]{2,3}$/,                  // locale codes, NL plate badge
  /^\d/,                           // numbers and dates
  /^[^a-z]*$/,                     // no lowercase letters: roman numerals, symbols, separators
  /^(Show|Hide)$/,                 // dev-only strings in the password toggle comment
];

const files: string[] = [];
const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx")) files.push(p);
  }
};
for (const root of ROOTS) walk(root);

const problems: string[] = [];
const allowed = (s: string) => ALLOW.some((r) => r.test(s.trim()));

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    const trimmed = line.trim();

    // A localizable attribute with a bare string value
    for (const attr of ATTRS) {
      const m = trimmed.match(new RegExp(`\\b${attr}="([^"]{3,})"`));
      if (m && !allowed(m[1]) && /[a-z]/.test(m[1])) problems.push(`${at}  ${attr}="${m[1]}"`);
    }

    // A JSX text node: a whole line of plain prose, no markup, expression or code punctuation.
    // Code lines end in , ( { ; : = — prose does not, so that alone removes most false hits.
    const isProse =
      !/[<>{}"`=]/.test(trimmed) &&
      !/[,({;:]$/.test(trimmed) &&
      !trimmed.startsWith("//") && !trimmed.startsWith("*") && !trimmed.startsWith("/*") &&
      /^[A-Z][A-Za-z ,.'’&;!?()/-]{8,}$/.test(trimmed) &&
      // at least two words, one of them lowercase: "All applications", not "AlertIcon"
      /\s[a-z]{2}/.test(trimmed);
    if (isProse && !allowed(trimmed)) problems.push(`${at}  ${trimmed}`);
  });
}

if (problems.length) {
  console.error(`✗ ${problems.length} hardcoded user-facing string(s) — move them to lib/i18n/dictionaries:\n`);
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log(`✓ no hardcoded user-facing strings in ${files.length} components`);
