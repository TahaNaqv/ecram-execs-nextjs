/** Class names the Corporate Partner screens share. Plain strings, so server and client components can both import them. */
export const submitClass =
  "min-h-[56px] w-full max-w-[420px] cursor-pointer border-none bg-ink-950 px-10 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase hover:bg-ink-800 disabled:pointer-events-none disabled:cursor-progress disabled:opacity-70";
export const ghostClass =
  "cursor-pointer border-none bg-transparent p-0 font-sans text-[12px] tracking-[0.18em] text-ink-700 uppercase underline underline-offset-4 hover:text-ink-950 disabled:cursor-progress disabled:opacity-60";
/** A link that looks like the forms' main button. `box-border`: a link is content-box here (a button is not), so the padding would otherwise push it past its card. */
export const linkButton =
  "box-border inline-flex min-h-[56px] w-full max-w-[420px] items-center justify-center bg-ink-950 px-10 font-sans text-[12px] font-semibold tracking-[0.24em] text-white uppercase no-underline hover:bg-ink-800";
/** The quieter version, for secondary actions. */
export const outlineButton =
  "box-border inline-flex min-h-[48px] items-center justify-center border border-solid border-ink-950 bg-transparent px-6 font-sans text-[12px] font-semibold tracking-[0.2em] text-ink-950 uppercase no-underline hover:bg-ink-950 hover:text-white";
