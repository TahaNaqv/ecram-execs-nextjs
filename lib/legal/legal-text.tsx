import Link from "next/link";
import type { ReactNode } from "react";
import { parseLegal, type Block, type Inline } from "./format";

type Tone = "site" | "admin";

const STYLE: Record<Tone, { h2: string; body: string; strong: string; list: string; sub: string; link: string; gap: string }> = {
  site: {
    h2: "m-0 font-serif text-[26px] leading-tight font-normal text-white md:text-[28px]",
    body: "flex flex-col gap-3 font-light text-ink-300",
    strong: "font-semibold text-ink-150",
    list: "m-0 flex list-disc flex-col gap-2.5 pl-5 marker:text-ink-500",
    sub: "m-0 mt-2 flex list-[circle] flex-col gap-1.5 pl-5",
    link: "text-white underline underline-offset-4",
    gap: "flex flex-col gap-8 md:gap-10",
  },
  admin: {
    h2: "m-0 text-base font-semibold text-zinc-950",
    body: "flex flex-col gap-2 text-sm text-zinc-700",
    strong: "font-semibold text-zinc-950",
    list: "m-0 flex list-disc flex-col gap-1.5 pl-5",
    sub: "m-0 mt-1.5 flex list-[circle] flex-col gap-1 pl-5",
    link: "text-zinc-950 underline underline-offset-2",
    gap: "flex flex-col gap-6",
  },
};

function Inlines({ parts, tone }: { parts: Inline[]; tone: Tone }) {
  const s = STYLE[tone];
  return (
    <>
      {parts.map((part, i) => {
        if (part.kind === "bold") return <strong key={i} className={s.strong}>{part.text}</strong>;
        if (part.kind === "link") {
          if (part.href.startsWith("/") || part.href.startsWith("#")) return <Link key={i} href={part.href} className={s.link}>{part.text}</Link>;
          const external = part.href.startsWith("http");
          return (
            <a key={i} href={part.href} className={s.link} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
              {part.text}
            </a>
          );
        }
        return <span key={i}>{part.text}</span>;
      })}
    </>
  );
}

function BlockView({ block, tone, cookies }: { block: Block; tone: Tone; cookies?: ReactNode }) {
  const s = STYLE[tone];
  if (block.kind === "cookies") {
    return cookies ?? <p className="m-0 italic opacity-70">[The cookie table and the cookie settings button appear here.]</p>;
  }
  if (block.kind === "paragraph") {
    return (
      <p className="m-0">
        <Inlines parts={block.content} tone={tone} />
      </p>
    );
  }
  return (
    <ul className={s.list}>
      {block.items.map((item, i) => (
        <li key={i}>
          <Inlines parts={item.content} tone={tone} />
          {item.sub.length > 0 && (
            <ul className={s.sub}>
              {item.sub.map((line, j) => (
                <li key={j}>
                  <Inlines parts={line} tone={tone} />
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

/** A legal document's text (lib/legal/format.ts) as page sections. `cookies` fills a [[cookies]] line. */
export function LegalText({ text, tone = "site", cookies }: { text: string; tone?: Tone; cookies?: ReactNode }) {
  const s = STYLE[tone];
  return (
    <div className={s.gap}>
      {parseLegal(text).map((section, i) => (
        <section key={i} id={section.anchor ?? undefined} className={`flex flex-col gap-3${section.anchor ? " scroll-mt-6" : ""}`}>
          {section.heading && (
            <h2 className={s.h2}>
              <Inlines parts={section.heading} tone={tone} />
            </h2>
          )}
          <div className={s.body}>
            {section.blocks.map((block, j) => (
              <BlockView key={j} block={block} tone={tone} cookies={cookies} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
