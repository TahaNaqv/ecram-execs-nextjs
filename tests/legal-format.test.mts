import assert from "node:assert/strict";
import { parseInline, parseLegal } from "../lib/legal/format.ts";
import { DEFAULT_LEGAL } from "../lib/legal/defaults.ts";

// Headings, anchors, bullets with sub-bullets, paragraphs joined across lines
const sections = parseLegal(
  "**Applicability:** All services.\n\n## Article 4 — Rates\n\n- **Fee:** €12.50\n  - one\n  - two\n- Second\n\n## Cookies {#cookies}\nFirst line\ncontinues.\n\n[[cookies]]\nAfter.",
);
assert.equal(sections.length, 3);
assert.equal(sections[0].heading, null);
assert.deepEqual(sections[0].blocks[0], { kind: "paragraph", content: [{ kind: "bold", text: "Applicability:" }, { kind: "text", text: " All services." }] });
assert.equal(sections[1].anchor, "article-4");
const list = sections[1].blocks[0];
assert.ok(list.kind === "list");
assert.equal(list.items.length, 2);
assert.equal(list.items[0].sub.length, 2);
assert.equal(sections[2].anchor, "cookies");
assert.deepEqual(sections[2].heading, [{ kind: "text", text: "Cookies" }]);
assert.deepEqual(sections[2].blocks[0], { kind: "paragraph", content: [{ kind: "text", text: "First line continues." }] });
assert.deepEqual(sections[2].blocks[1], { kind: "cookies" });

// Only safe link targets become links; nothing else is interpreted
assert.deepEqual(parseInline("[mail](mailto:a@b.nl)"), [{ kind: "link", text: "mail", href: "mailto:a@b.nl" }]);
assert.deepEqual(parseInline("[x](javascript:alert(1))")[0].kind, "text");
assert.deepEqual(parseInline("<b>hi</b>"), [{ kind: "text", text: "<b>hi</b>" }]);

// The seeded texts parse into the expected shape: 27 articles, and the privacy policy's cookie table
const terms = parseLegal(DEFAULT_LEGAL.terms.body);
assert.equal(terms.filter((s) => s.anchor?.startsWith("article-")).length, 27);
const privacy = parseLegal(DEFAULT_LEGAL.privacy.body);
assert.ok(privacy.some((s) => s.anchor === "cookies" && s.blocks.some((b) => b.kind === "cookies")));
assert.equal(privacy.filter((s) => s.heading).length, 8);

console.log("legal format: ok");
