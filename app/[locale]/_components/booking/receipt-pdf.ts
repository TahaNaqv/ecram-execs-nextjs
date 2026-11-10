export type ReceiptPdfInput = {
  reference: string;
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  route: string;
  when: string;
  pickup?: string;
  stops?: string[];
  dropoff?: string;
  vehicle?: string;
  passengers?: string;
  /** The price lines above the total, already formatted; none when the total cannot be split */
  lines: { label: string; value: string }[];
  total: string;
};

function pdfText(value: string): string {
  const mapped = value
    .replaceAll("€", "EUR ")
    .replaceAll("→", " - ")
    .replaceAll("·", " | ")
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll("\u00a0", " ");
  let out = "";
  for (const ch of mapped) {
    const code = ch.codePointAt(0) ?? 63;
    if (ch === "\\" || ch === "(" || ch === ")") out += `\\${ch}`;
    else if (code >= 32 && code <= 126) out += ch;
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, "0")}`;
    else out += "?";
  }
  return out;
}

function wrap(value: string, max: number): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function assemble(stream: string): Uint8Array {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(body.length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) body += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(body);
}

/** A one-page booking confirmation. Standard fonts only, so it downloads with no extra library. */
export function buildReceiptPdf(input: ReceiptPdfInput): Uint8Array {
  const navy = "0.031 0.106 0.384";
  const ink = "0.063 0.133 0.310";
  const muted = "0.42 0.45 0.52";
  const mint = "0.431 0.906 0.718";
  const cmds: string[] = [];
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    cmds.push(`${color} rg`, `${x} ${y} ${w} ${h} re f`);
  };
  const text = (font: "F1" | "F2", size: number, x: number, y: number, color: string, value: string) => {
    cmds.push("BT", `${color} rg`, `/${font} ${size} Tf`, `1 0 0 1 ${x} ${y} Tm`, `(${pdfText(value)}) Tj`, "ET");
  };
  const textRight = (font: "F1" | "F2", size: number, right: number, y: number, color: string, value: string) => {
    const shown = pdfText(value);
    text(font, size, right - shown.length * size * 0.52, y, color, value);
  };

  fill(navy, 0, 742, 595, 100);
  text("F1", 10, 48, 808, "0.82 0.86 0.95", "ECRAM EXECS");
  text("F2", 18, 48, 780, "1 1 1", "BOOKING CONFIRMATION");
  text("F1", 11, 48, 758, "0.82 0.86 0.95", `Reference: ${input.reference}${input.status ? `   ·   ${input.status}` : ""}`);

  let y = 708;
  text("F2", 9, 48, y, muted, "CLIENT");
  text("F2", 9, 320, y, muted, "ITINERARY & DISTANCE");
  y -= 18;
  const left = [input.clientName, input.clientEmail, input.clientPhone].filter(Boolean);
  const journey = [input.pickup, ...(input.stops ?? []), input.dropoff].filter(Boolean).join(" - ");
  const right = [...wrap(journey || input.route, 34), input.when, input.vehicle, input.passengers].filter((line): line is string => Boolean(line));
  const rows = Math.max(left.length, right.length, 1);
  for (let i = 0; i < rows; i++) {
    if (left[i]) text(i === 0 ? "F2" : "F1", i === 0 ? 12 : 10, 48, y, i === 0 ? ink : muted, left[i]);
    if (right[i]) text(i === 0 ? "F2" : "F1", i === 0 ? 12 : 10, 320, y, i === 0 ? ink : muted, right[i]);
    y -= 16;
  }

  y -= 8;
  cmds.push("0.82 0.84 0.88 RG", "0.8 w", `48 ${y} m 547 ${y} l S`);
  y -= 24;
  const money = (label: string, value: string) => {
    text("F1", 11, 48, y, ink, label);
    textRight("F2", 11, 547, y, ink, value);
    y -= 22;
  };
  for (const line of input.lines) money(line.label, line.value);

  y -= 14;
  fill(navy, 48, y - 16, 499, 42);
  text("F2", 11, 64, y, "0.9 0.92 0.96", "FINAL AMOUNT (INCL. TAX)");
  textRight("F2", 14, 531, y - 1, mint, input.total);
  y -= 48;
  text("F1", 9, 48, y, muted, "Ecram Execs Chauffeur Services  |  Amsterdam, Netherlands");

  return assemble(cmds.join("\n"));
}

export function downloadReceiptPdf(filename: string, bytes: Uint8Array) {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
