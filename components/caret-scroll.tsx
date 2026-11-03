"use client";

import { useEffect } from "react";

let measure: CanvasRenderingContext2D | null = null;

/** Chromium leaves a long value pinned to the end of the box. Move the visible slice so the caret stays on screen. */
function scrollCaretIntoView(input: HTMLInputElement) {
  if (input.type === "email" || input.type === "number" || input.type === "password" || input.type === "hidden") return;
  if (input.scrollWidth <= input.clientWidth + 1) return;
  const pos = input.selectionDirection === "backward" ? input.selectionStart : input.selectionEnd;
  if (pos == null) return;
  if (!measure) measure = document.createElement("canvas").getContext("2d");
  if (!measure) return;
  const style = getComputedStyle(input);
  measure.font = style.font;
  const caret = measure.measureText(input.value.slice(0, pos)).width;
  const view = input.clientWidth - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0);
  if (view <= 0) return;
  const slack = 8;
  if (caret < input.scrollLeft + slack) input.scrollLeft = Math.max(0, caret - slack);
  else if (caret > input.scrollLeft + view - slack) input.scrollLeft = Math.max(0, caret - view + slack);
}

/** Arrow keys, typing, and dragging the mouse all leave the caret where the visitor put it, then this brings that spot into view. */
export function CaretScroll() {
  useEffect(() => {
    const on = (event: Event) => {
      if (event.target instanceof HTMLInputElement) scrollCaretIntoView(event.target);
    };
    const onDrag = (event: MouseEvent) => {
      if (event.buttons === 1) on(event);
    };
    document.addEventListener("keyup", on);
    document.addEventListener("mouseup", on);
    document.addEventListener("click", on);
    document.addEventListener("input", on);
    document.addEventListener("mousemove", onDrag);
    return () => {
      document.removeEventListener("keyup", on);
      document.removeEventListener("mouseup", on);
      document.removeEventListener("click", on);
      document.removeEventListener("input", on);
      document.removeEventListener("mousemove", onDrag);
    };
  }, []);
  return null;
}
