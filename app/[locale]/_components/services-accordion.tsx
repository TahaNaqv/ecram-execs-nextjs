"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";

export type ServiceItem = {
  key: string;
  numeral: string;
  title: string;
  text: string;
  points: string[];
  image: string;
  /** Where the picture is anchored when the card crops it (CSS object-position), so the subject stays in view */
  focus: string;
  cta: { label: string; href: string };
};

/**
 * The services as picture cards. Each shows a photograph and its title; pressing one unfolds the details of that service
 * over the picture (what it covers and a button to book it), and pressing it again, another card or Escape folds it back.
 * One is open at a time. The folding is a grid-row transition (450 ms, short enough that the layout shift counts as caused by the press) from 0fr to 1fr, so it animates to the details' real height
 * with no measuring; visitors who ask their device to reduce motion get the same change without the animation (site.css).
 * Details that are folded away are `inert`, so they are neither read out nor reachable with the Tab key.
 */
export function ServicesAccordion({ items }: { items: ServiceItem[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const id = useId();
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  return (
    <div className="gap-px border border-ink-825 bg-ink-825 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const isOpen = open === item.key;
        const panel = `${id}-${item.key}-panel`;
        const trigger = `${id}-${item.key}-trigger`;
        return (
          <article
            key={item.key}
            data-open={isOpen}
            className="reveal-card group relative isolate flex min-h-[360px] overflow-hidden bg-ink-950 md:min-h-[420px]"
            onKeyDown={(e) => {
              if (e.key === "Escape" && isOpen) {
                e.stopPropagation();
                setOpen(null);
                buttons.current.get(item.key)?.focus();
              }
            }}
          >
            <Image
              src={item.image}
              alt=""
              fill
              sizes="(min-width: 1280px) 427px, (min-width: 768px) 50vw, 100vw"
              style={{ objectPosition: item.focus }}
              className={`-z-20 object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.2,0.7,0.1,1)] ${isOpen ? "scale-110" : "scale-100 group-hover:scale-105"}`}
            />
            {/* Always a little darker towards the heading; much darker while the details are open, so the text reads */}
            <div className="-z-10 absolute inset-0 bg-[linear-gradient(180deg,rgba(10,10,11,0.05)_0%,rgba(10,10,11,0.35)_45%,rgba(10,10,11,0.88)_100%)]" aria-hidden="true" />
            <div className={`-z-10 absolute inset-0 bg-ink-950/75 transition-opacity duration-700 ${isOpen ? "opacity-100" : "opacity-0"}`} aria-hidden="true" />

            <div className="flex w-full flex-col justify-end p-6 md:p-8">
              <h3 className="m-0 font-serif text-[26px] font-normal text-white md:text-[30px]">
                <button
                  type="button"
                  id={trigger}
                  ref={(el) => {
                    if (el) buttons.current.set(item.key, el);
                    else buttons.current.delete(item.key);
                  }}
                  aria-expanded={isOpen}
                  aria-controls={panel}
                  onClick={() => setOpen(isOpen ? null : item.key)}
                  className="flex w-full cursor-pointer items-end justify-between gap-4 border-none bg-transparent p-0 text-left font-[inherit] text-[length:inherit] text-inherit"
                >
                  <span className="flex flex-col gap-2">
                    <span className="chrome font-display text-[18px] md:text-[22px]" aria-hidden="true">{item.numeral}</span>
                    <span>{item.title}</span>
                  </span>
                  <span
                    className="mb-1 grid size-9 shrink-0 place-items-center rounded-full border border-solid border-ink-250 bg-ink-950/40 text-white backdrop-blur-sm transition-colors duration-300 group-hover:bg-white group-hover:text-ink-950"
                    aria-hidden="true"
                  >
                    <svg className={`transition-transform duration-500 ${isOpen ? "rotate-45" : ""}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </button>
              </h3>

              <div
                id={panel}
                role="region"
                aria-labelledby={trigger}
                inert={!isOpen}
                className={`grid transition-[grid-template-rows] duration-[450ms] ease-[cubic-bezier(0.2,0.7,0.1,1)] ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              >
                <div className="-mx-2 min-h-0 overflow-hidden px-2">
                  <div className={`flex flex-col gap-4 pb-2 pt-5 transition-[opacity,transform] duration-[450ms] ease-out ${isOpen ? "translate-y-0 opacity-100 delay-100" : "translate-y-3 opacity-0"}`}>
                    <p className="m-0 text-[15px] font-light text-ink-150">{item.text}</p>
                    <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[14px] font-light text-ink-300">
                      {item.points.map((point) => (
                        <li key={point} className="flex gap-3">
                          <span className="mt-[0.7em] h-px w-4 shrink-0 bg-ink-450" aria-hidden="true" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="pt-1">
                      {item.cta.href.startsWith("#") ? (
                        <a className="btn-fill no-underline items-center bg-ink-50 text-ink-950 inline-flex text-[11px] font-semibold justify-center tracking-[0.22em] min-h-[46px] px-6 uppercase" href={item.cta.href}>
                          {item.cta.label}
                        </a>
                      ) : (
                        <Link className="btn-fill no-underline items-center bg-ink-50 text-ink-950 inline-flex text-[11px] font-semibold justify-center tracking-[0.22em] min-h-[46px] px-6 uppercase" href={item.cta.href}>
                          {item.cta.label}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
