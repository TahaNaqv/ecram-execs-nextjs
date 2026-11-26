/**
 * The plain-text format of the legal documents (Terms & Conditions, Privacy Policy) that the team edits in Settings, and
 * its parser. Deliberately small, so the text stays readable in a textarea and nothing but these shapes reach the page:
 *
 *   ## Article 4 — Rates            a section heading; "## Cookies {#cookies}" also gives it an anchor
 *   - A point                       a bullet; "  - A sub-point" (indented) sits under the bullet above it
 *   **Label:** text                 bold, anywhere in a line
 *   [our email](mailto:a@b.nl)      a link: https://, http://, mailto:, a path on the site (/...) or an anchor (#...)
 *   [[cookies]]                     on its own line: the cookie table and the cookie settings button (Privacy Policy)
 *
 * Any other line is text; lines next to each other form one paragraph and a blank line starts a new one. No HTML is ever
 * read from the text: the page builds its own elements from the parsed blocks.
 */

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "link"; text: string; href: string };

export type Block =
  | { kind: "paragraph"; content: Inline[] }
  | { kind: "list"; items: { content: Inline[]; sub: Inline[][] }[] }
  | { kind: "cookies" };

export type Section = { heading: Inline[] | null; anchor: string | null; blocks: Block[] };

const SAFE_HREF = /^(https?:\/\/[^\s]+|mailto:[^\s]+|\/[^\s]*|#[\w-]+)$/i;

/** **bold** and [label](href) inside one line. A link with an address that is not allowed stays plain text. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const pattern = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) out.push({ kind: "text", text: line.slice(last, at) });
    if (match[1] !== undefined) out.push({ kind: "bold", text: match[1] });
    else if (SAFE_HREF.test(match[3])) out.push({ kind: "link", text: match[2], href: match[3] });
    else out.push({ kind: "text", text: match[0] });
    last = at + match[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}

/** "Article 12 — ..." headings get the anchor the old page used (#article-12), so links into the terms keep working. */
function headingAnchor(title: string): { title: string; anchor: string | null } {
  const explicit = title.match(/^(.*?)\s*\{#([\w-]{1,60})\}\s*$/);
  if (explicit) return { title: explicit[1], anchor: explicit[2] };
  const article = title.match(/^Article\s+(\d+)\b/i);
  return { title, anchor: article ? `article-${article[1]}` : null };
}

/** The text split into sections: whatever comes before the first heading is a section without one. */
export function parseLegal(text: string): Section[] {
  const sections: Section[] = [{ heading: null, anchor: null, blocks: [] }];
  let paragraph: string[] = [];
  let list: Extract<Block, { kind: "list" }> | null = null;
  const current = () => sections[sections.length - 1];
  const flush = () => {
    if (paragraph.length > 0) current().blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
    paragraph = [];
    list = null;
  };

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) {
      flush();
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      const { title, anchor } = headingAnchor(line.slice(3).trim());
      sections.push({ heading: parseInline(title), anchor, blocks: [] });
      continue;
    }
    if (line.trim() === "[[cookies]]") {
      flush();
      current().blocks.push({ kind: "cookies" });
      continue;
    }
    const bullet = line.match(/^(\s*)[-•]\s+(.*)$/);
    if (bullet) {
      if (paragraph.length > 0) {
        current().blocks.push({ kind: "paragraph", content: parseInline(paragraph.join(" ")) });
        paragraph = [];
      }
      const indented = bullet[1].length >= 2;
      if (indented && list && list.items.length > 0) {
        list.items[list.items.length - 1].sub.push(parseInline(bullet[2]));
      } else {
        if (!list) {
          list = { kind: "list", items: [] };
          current().blocks.push(list);
        }
        list.items.push({ content: parseInline(bullet[2]), sub: [] });
      }
      continue;
    }
    if (list) list = null;
    paragraph.push(line.trim());
  }
  flush();
  return sections.filter((section) => section.heading !== null || section.blocks.length > 0);
}
