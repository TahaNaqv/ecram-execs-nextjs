import { NextRequest, NextResponse } from "next/server";
import { desc, eq, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { formatEuro } from "@/lib/admin/format";
import { buildBookingReceipt, type ReceiptBooking } from "@/lib/admin/financial-receipt";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

const NO_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate",
  "X-Robots-Tag": "noindex",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() || "mock_mb_12345";
    const wantPdf = searchParams.get("pdf") === "1" || searchParams.get("format") === "pdf" || searchParams.get("download") === "1";

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // 1. Look up invoice by moneybirdId, reference, number, or internal id
    let invoice = null;
    try {
      const invoiceCond = isUuid
        ? or(
            eq(schema.moneybirdInvoices.id, id),
            eq(schema.moneybirdInvoices.moneybirdId, id),
            eq(schema.moneybirdInvoices.reference, id),
            eq(schema.moneybirdInvoices.number, id),
          )
        : or(
            eq(schema.moneybirdInvoices.moneybirdId, id),
            eq(schema.moneybirdInvoices.reference, id),
            eq(schema.moneybirdInvoices.number, id),
          );

      const [found] = await db
        .select()
        .from(schema.moneybirdInvoices)
        .where(invoiceCond)
        .limit(1);
      invoice = found ?? null;
    } catch (dbErr) {
      console.warn("[mock/moneybird/invoice] could not query invoices table", dbErr);
    }

    // 2. Look up booking details
    let booking: typeof schema.quoteRequests.$inferSelect | null = null;
    if (invoice?.requestId) {
      const isReqUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoice.requestId);
      if (isReqUuid) {
        try {
          const [found] = await db
            .select()
            .from(schema.quoteRequests)
            .where(eq(schema.quoteRequests.id, invoice.requestId))
            .limit(1);
          booking = found ?? null;
        } catch (dbErr) {
          console.warn("[mock/moneybird/invoice] could not query booking by requestId", dbErr);
        }
      }
    }

    if (!booking) {
      try {
        const bookingCond = isUuid
          ? or(eq(schema.quoteRequests.id, id), eq(schema.quoteRequests.reference, id))
          : eq(schema.quoteRequests.reference, id);

        const [byRefOrId] = await db
          .select()
          .from(schema.quoteRequests)
          .where(bookingCond)
          .limit(1);
        booking = byRefOrId ?? null;
      } catch {
        // ignore
      }
    }

    if (!booking) {
      try {
        const [latest] = await db
          .select()
          .from(schema.quoteRequests)
          .orderBy(desc(schema.quoteRequests.createdAt))
          .limit(1);
        booking = latest ?? null;
      } catch {
        // ignore
      }
    }

    // 3. Fallback mock values if DB has no booking
    const fallbackBooking = {
      id: "00000000-0000-0000-0000-000000000001",
      reference: "EE-ABC123",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "confirmed",
      service: "hourly",
      collection: "Amsterdam Airport Schiphol (AMS)",
      destination: null,
      destinations: null,
      destinationWaits: null,
      pickupAt: new Date(Date.now() + 86400000).toISOString(),
      returnAt: null,
      durationHours: 2,
      passengers: 2,
      luggage: 2,
      handLuggage: 2,
      vehicle: "audi",
      vehicleCount: 1,
      vehicles: [{ key: "audi", count: 1 }],
      flightNumber: null,
      notes: null,
      name: "Valued Client",
      email: "client@example.com",
      phone: "+31 6 12345678",
      passengerName: null,
      passengerPhone: null,
      quotedAmount: "178.63",
      priceEstimate: {
        version: "2027-01",
        segment: "public",
        exact: true,
        legs: [],
        rides: 15000,
        vat: 1350,
        fee: 1250,
        feeVat: 263,
        extras: [],
        extrasVat: 0,
        total: 17863,
      },
      locale: "en",
      paymentPlan: null,
      corporateContactId: null,
      entity: null,
      itinerary: null,
    } as unknown as typeof schema.quoteRequests.$inferSelect;

    const effectiveBooking = booking ?? fallbackBooking;
    const isDutch = effectiveBooking.locale === "nl";
    const receiptLocale: Locale = isDutch ? "nl" : "en";

    // 4. Return PDF directly if requested
    if (wantPdf) {
      const dict = await getDictionary(receiptLocale);
      const receiptInput: ReceiptBooking = {
        reference: effectiveBooking.reference,
        name: effectiveBooking.name,
        email: effectiveBooking.email,
        phone: effectiveBooking.phone,
        collection: effectiveBooking.collection,
        destination: effectiveBooking.destination,
        destinations: effectiveBooking.destinations,
        pickupAt: effectiveBooking.pickupAt,
        createdAt: effectiveBooking.createdAt,
        vehicle: effectiveBooking.vehicle,
        vehicles: effectiveBooking.vehicles,
        quotedAmount: effectiveBooking.quotedAmount,
        priceEstimate: effectiveBooking.priceEstimate,
        service: effectiveBooking.service,
        durationHours: effectiveBooking.durationHours,
        entity: effectiveBooking.entity,
        itinerary: effectiveBooking.itinerary,
      };

      const pdfBytes = buildBookingReceipt(
        receiptInput,
        {
          status: dict.admin.statuses[effectiveBooking.status] ?? effectiveBooking.status,
          service: dict.services[effectiveBooking.service] ?? effectiveBooking.service,
          hourly: dict.admin.requestDetail.durationValue,
          net: dict.admin.financials.receiptNet,
          vatLow: dict.booking.priceVat,
          vatHigh: dict.booking.priceVatHigh,
          words: {
            receiptRides: dict.booking.receiptRides,
            receiptKm: dict.booking.receiptKm,
            priceServiceFee: dict.booking.priceServiceFee,
            priceVat: dict.booking.priceVat,
            priceVatHigh: dict.booking.priceVatHigh,
            priceFeeVat: dict.booking.priceFeeVat,
          },
          extras: dict.addOns,
          stopLabel: dict.booking.stopLabel,
        },
        receiptLocale,
      );

      const safeRef = effectiveBooking.reference.replace(/[^A-Za-z0-9-]/g, "") || "receipt";
      return new Response(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          ...NO_CACHE_HEADERS,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="ecram-execs-${safeRef}.pdf"`,
        },
      });
    }

    // 5. Build Moneybird live view replica data
    const totalCents = invoice?.totalCents ?? (effectiveBooking.quotedAmount ? Math.round(Number(effectiveBooking.quotedAmount) * 100) : 17863);
    const invoiceNumber = invoice?.number ?? "2026-0019";
    const totalFormatted = formatEuro((totalCents / 100).toFixed(2));
    const clientName = effectiveBooking.name || "Valued Client";
    const clientEmail = effectiveBooking.email || "guest@example.com";
    const reference = effectiveBooking.reference;
    const downloadPdfUrl = `/api/mock/moneybird/invoice?id=${encodeURIComponent(id)}&pdf=1`;
    const backUrl = booking?.id ? `/admin/requests/${booking.id}` : "/admin";

    const labels = isDutch
      ? {
          allInvoices: "Alle facturen",
          download: "Downloaden",
          invoice: "Factuur",
          expiresIn: "Vervalt over 30 dagen",
          enterAccessCode: "Voer de toegangscode in om de factuur te bekijken.",
          receivedByEmail: "Factuur per e-mail ontvangen?",
          accessCodeHelp: "U vindt de toegangscode in de e-mail van de persoon die u de factuur heeft gestuurd.",
          revealButton: "Of klik hier om factuur direct te ontgrendelen",
          paymentTitle: `Betaling factuur ${invoiceNumber}`,
          paymentDescription: `Betaal de factuur met een openstaand bedrag van ${totalFormatted} via de QR-code.`,
          paymentDetailsButton: "Betaalgegevens / QR-code",
          dialogTitle: "Betaalgegevens",
          dialogDesc: "Scan de QR-code met uw mobiel bankieren-app om deze factuur te betalen.",
          beneficiary: "Begunstigde",
          iban: "IBAN",
          amount: "Bedrag",
          paymentRef: "Betalingskenmerk",
          copy: "Kopiëren",
          copied: "Gekopieerd!",
          close: "Sluiten",
          billedTo: "Gefactureerd aan",
          date: "Factuurdatum",
          due: "Vervaldatum",
          description: "Omschrijving",
          vat: "Btw",
          total: "Totaal",
          totalDue: "Totaal te betalen",
          terms: `We verzoeken u vriendelijk het bovenstaande bedrag van ${totalFormatted} voor de vervaldatum te voldoen op onze bankrekening onder vermelding van de omschrijving ${invoiceNumber}. Voor vragen kunt u contact opnemen per e-mail.`,
        }
      : {
          allInvoices: "All invoices",
          download: "Download",
          invoice: "Invoice",
          expiresIn: "Expires in 30 days",
          enterAccessCode: "Enter the access code to view the invoice.",
          receivedByEmail: "Received the invoice by email?",
          accessCodeHelp: "You can find the access code in the email from the person who sent you the invoice.",
          revealButton: "Or click here to unlock and view full invoice",
          paymentTitle: `Payment invoice ${invoiceNumber}`,
          paymentDescription: `Pay the invoice with an outstanding amount of ${totalFormatted} via the QR code.`,
          paymentDetailsButton: "Payment details / QR code",
          dialogTitle: "Payment details",
          dialogDesc: "Scan the QR code with your mobile banking app to pay this invoice.",
          beneficiary: "Beneficiary",
          iban: "IBAN",
          amount: "Amount",
          paymentRef: "Payment reference",
          copy: "Copy",
          copied: "Copied!",
          close: "Close",
          billedTo: "Billed to",
          date: "Invoice date",
          due: "Due date",
          description: "Description",
          vat: "VAT",
          total: "Total",
          totalDue: "Total due",
          terms: `We kindly request you to pay the amount of ${totalFormatted} before the due date to our bank account stating reference ${invoiceNumber}. For questions, please contact us by email.`,
        };

    const html = `<!DOCTYPE html>
<html lang="${isDutch ? "nl" : "en"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${labels.invoice} ${invoiceNumber} · Moneybird</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #f3f4f6;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Navigation Bar */
    .top-nav {
      max-width: 1140px;
      width: 100%;
      margin: 0 auto;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .back-link:hover { color: #111827; }
    .download-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      text-decoration: none;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .download-btn:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }

    /* Main Container */
    .main-container {
      max-width: 1140px;
      width: 100%;
      margin: 0 auto;
      padding: 12px 24px 60px 24px;
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 32px;
      align-items: start;
    }
    @media (max-width: 900px) {
      .main-container {
        grid-template-columns: 1fr;
        gap: 24px;
      }
    }

    /* Left: Invoice Paper Card */
    .invoice-card {
      background: #ffffff;
      border-radius: 14px;
      box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.04);
      border: 1px solid #e5e7eb;
      padding: 44px;
      position: relative;
      overflow: hidden;
    }
    .invoice-header {
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      margin-bottom: 28px;
    }
    .invoice-header-meta {
      text-align: right;
    }
    .invoice-title {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }
    .expires-badge {
      display: inline-block;
      margin-top: 6px;
      background: #935a16;
      color: #ffffff;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 9999px;
      letter-spacing: 0.02em;
    }

    /* Blurred background placeholder lines */
    .placeholder-lines {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
      opacity: 0.35;
      filter: blur(1px);
    }
    .placeholder-bar {
      height: 16px;
      background: #9ca3af;
      border-radius: 4px;
    }

    /* Access Code Box */
    .access-box {
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      padding: 32px;
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
      margin-bottom: 24px;
      transition: all 0.3s ease;
    }
    .access-box.unlocked {
      display: none;
    }
    .access-title {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
      line-height: 1.3;
      margin-bottom: 24px;
    }
    .code-inputs {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
    }
    .code-digit {
      width: 52px;
      height: 52px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 24px;
      font-weight: 600;
      text-align: center;
      color: #111827;
      outline: none;
      transition: all 0.15s ease;
      background: #ffffff;
    }
    .code-digit:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .access-help {
      font-size: 14px;
      line-height: 1.5;
      color: #4b5563;
    }
    .access-help strong {
      display: block;
      color: #111827;
      margin-bottom: 4px;
    }
    .quick-unlock-btn {
      display: inline-block;
      margin-top: 14px;
      font-size: 13px;
      color: #2563eb;
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }

    /* Invoice Content Details (revealed) */
    .invoice-details {
      display: none;
    }
    .invoice-details.active {
      display: block;
      animation: fadeIn 0.3s ease-in-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .party-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e5e7eb;
      margin-bottom: 28px;
    }
    .party-col h4 {
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    .party-col p {
      font-size: 14px;
      line-height: 1.5;
      color: #1f2937;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #4b5563;
      padding: 3px 0;
    }
    .meta-row strong { color: #111827; }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    .items-table th {
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #6b7280;
      padding: 10px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .items-table td {
      padding: 14px 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
      color: #1f2937;
    }
    .items-table .num { text-align: right; }
    .totals-box {
      margin-left: auto;
      width: 260px;
      border-top: 2px solid #111827;
      padding-top: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      padding: 4px 0;
      color: #4b5563;
    }
    .total-row.grand {
      font-size: 16px;
      font-weight: 700;
      color: #111827;
      border-top: 1px solid #e5e7eb;
      margin-top: 8px;
      padding-top: 8px;
    }
    .terms-text {
      margin-top: 24px;
      padding: 14px 16px;
      background: #f9fafb;
      border-radius: 8px;
      font-size: 13px;
      color: #4b5563;
      line-height: 1.5;
      border: 1px solid #f3f4f6;
    }

    /* Right: Payment Card */
    .payment-card {
      background: #ffffff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      padding: 28px 24px;
    }
    .payment-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      letter-spacing: -0.01em;
    }
    .payment-desc {
      font-size: 14px;
      line-height: 1.5;
      color: #374151;
      margin-top: 12px;
      margin-bottom: 24px;
    }
    .payment-action-btn {
      width: 100%;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease;
    }
    .payment-action-btn:hover {
      background: #f9fafb;
      border-color: #cbd5e1;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.03);
    }
    .btn-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .qr-icon {
      color: #111827;
      display: flex;
      align-items: center;
    }
    .btn-text {
      font-size: 14px;
      font-weight: 500;
      color: #111827;
    }
    .chevron-right {
      color: #9ca3af;
      font-size: 16px;
      font-weight: 600;
    }

    /* Modal Dialog (Payment details / QR code) */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(2px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
      z-index: 1000;
    }
    .modal-overlay.active {
      display: flex;
    }
    .modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      border: 1px solid #e5e7eb;
      overflow: hidden;
      animation: modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes modalPop {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .modal-header {
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid #e5e7eb;
    }
    .modal-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }
    .modal-close {
      background: none;
      border: none;
      font-size: 20px;
      color: #6b7280;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .modal-close:hover {
      background: #f3f4f6;
      color: #111827;
    }
    .modal-body {
      padding: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    .modal-desc {
      font-size: 14px;
      color: #4b5563;
      margin-bottom: 20px;
      line-height: 1.4;
    }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-svg {
      width: 190px;
      height: 190px;
    }
    .details-list {
      width: 100%;
      text-align: left;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: 13px;
    }
    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }
    .detail-label {
      color: #6b7280;
      font-weight: 500;
    }
    .detail-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-weight: 600;
      color: #111827;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .copy-pill {
      font-family: inherit;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 2px 8px;
      font-size: 11px;
      cursor: pointer;
      color: #374151;
      transition: all 0.15s ease;
    }
    .copy-pill:hover {
      background: #e5e7eb;
      color: #111827;
    }
    .modal-footer {
      padding: 16px 24px;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: flex-end;
    }
    .close-btn {
      padding: 8px 18px;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #374151;
      cursor: pointer;
    }
    .close-btn:hover { background: #f3f4f6; }
  </style>
</head>
<body>
  <!-- Top Bar -->
  <div class="top-nav">
    <a href="${backUrl}" class="back-link">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13L5 8l5-5"/></svg>
      <span>${labels.allInvoices}</span>
    </a>
    <a href="${downloadPdfUrl}" target="_blank" class="download-btn">
      <span>${labels.download}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>
    </a>
  </div>

  <!-- Main 2-Column Grid -->
  <div class="main-container">
    <!-- Left: Invoice Sheet -->
    <div class="invoice-card">
      <div class="invoice-header">
        <div class="invoice-header-meta">
          <div class="invoice-title">${labels.invoice} ${invoiceNumber}</div>
          <div class="expires-badge">${labels.expiresIn}</div>
        </div>
      </div>

      <!-- Access Code Box (As shown in screenshot) -->
      <div id="access-box" class="access-box">
        <div class="access-title">${labels.enterAccessCode}</div>
        <div class="code-inputs">
          <input type="text" maxlength="1" class="code-digit" autofocus />
          <input type="text" maxlength="1" class="code-digit" />
          <input type="text" maxlength="1" class="code-digit" />
          <input type="text" maxlength="1" class="code-digit" />
          <input type="text" maxlength="1" class="code-digit" />
        </div>
        <div class="access-help">
          <strong>${labels.receivedByEmail}</strong>
          ${labels.accessCodeHelp}
        </div>
        <button type="button" class="quick-unlock-btn" onclick="unlockInvoice()">${labels.revealButton}</button>
      </div>

      <!-- Invoice Details (Revealed on access code or click) -->
      <div id="invoice-details" class="invoice-details">
        <div class="party-grid">
          <div class="party-col">
            <h4>Ecram Execs B.V.</h4>
            <p>Keizersgracht 482<br>1016 GD Amsterdam<br>KvK: 87654321<br>BTW: NL876543210B01</p>
          </div>
          <div class="party-col">
            <h4>${labels.billedTo}</h4>
            <p><strong>${clientName}</strong><br>${clientEmail}<br>${effectiveBooking.phone || ""}</p>
          </div>
        </div>

        <div style="margin-bottom: 24px;">
          <div class="meta-row"><span>${labels.invoice}:</span> <strong>${invoiceNumber}</strong></div>
          <div class="meta-row"><span>${labels.date}:</span> <strong>${new Date().toLocaleDateString(isDutch ? "nl-NL" : "en-GB")}</strong></div>
          <div class="meta-row"><span>${labels.due}:</span> <strong>${new Date(Date.now() + 30 * 86400000).toLocaleDateString(isDutch ? "nl-NL" : "en-GB")}</strong></div>
          <div class="meta-row"><span>Reference:</span> <strong>${reference}</strong></div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>${labels.description}</th>
              <th class="num">${labels.vat}</th>
              <th class="num">${labels.amount}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Executive Chauffeur Service</strong>
                <div style="font-size: 12px; color: #6b7280; margin-top: 2px;">
                  ${effectiveBooking.collection || "Amsterdam"} → ${effectiveBooking.destination || (effectiveBooking.durationHours ? `${effectiveBooking.durationHours} hours as directed` : "Destination")} · Audi e-tron GT
                </div>
              </td>
              <td class="num">9%</td>
              <td class="num">${totalFormatted}</td>
            </tr>
          </tbody>
        </table>

        <div class="totals-box">
          <div class="total-row"><span>${labels.total}:</span> <span>${totalFormatted}</span></div>
          <div class="total-row grand"><span>${labels.totalDue}:</span> <span>${totalFormatted}</span></div>
        </div>

        <div class="terms-text">
          ${labels.terms}
        </div>
      </div>
    </div>

    <!-- Right: Payment Widget -->
    <div class="payment-card">
      <div class="payment-title">${labels.paymentTitle}</div>
      <div class="payment-desc">${labels.paymentDescription}</div>

      <button type="button" class="payment-action-btn" onclick="openQrModal()">
        <div class="btn-left">
          <span class="qr-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
          </span>
          <span class="btn-text">${labels.paymentDetailsButton}</span>
        </div>
        <span class="chevron-right">&gt;</span>
      </button>
    </div>
  </div>

  <!-- Payment details / QR code Modal Dialog -->
  <div id="qr-modal" class="modal-overlay" onclick="closeQrModal(event)">
    <div class="modal-dialog" onclick="event.stopPropagation()">
      <div class="modal-header">
        <h3 class="modal-title">${labels.dialogTitle}</h3>
        <button type="button" class="modal-close" onclick="closeQrModal()">&times;</button>
      </div>

      <div class="modal-body">
        <p class="modal-desc">${labels.dialogDesc}</p>

        <!-- SEPA EPC QR Code -->
        <div class="qr-container">
          <svg class="qr-svg" viewBox="0 0 160 160" fill="none">
            <!-- Background -->
            <rect width="160" height="160" fill="white" />
            
            <!-- Top-Left Finder -->
            <rect x="10" y="10" width="35" height="35" fill="black" />
            <rect x="15" y="15" width="25" height="25" fill="white" />
            <rect x="20" y="20" width="15" height="15" fill="black" />
            
            <!-- Top-Right Finder -->
            <rect x="115" y="10" width="35" height="35" fill="black" />
            <rect x="120" y="15" width="25" height="25" fill="white" />
            <rect x="125" y="20" width="15" height="15" fill="black" />
            
            <!-- Bottom-Left Finder -->
            <rect x="10" y="115" width="35" height="35" fill="black" />
            <rect x="15" y="120" width="25" height="25" fill="white" />
            <rect x="20" y="125" width="15" height="15" fill="black" />

            <!-- Timing and Alignment Patterns -->
            <rect x="50" y="22" width="55" height="5" fill="black" stroke="white" stroke-dasharray="5,5" />
            <rect x="22" y="50" width="5" height="55" fill="black" stroke="white" stroke-dasharray="5,5" />
            <rect x="105" y="105" width="25" height="25" fill="black" />
            <rect x="110" y="110" width="15" height="15" fill="white" />
            <rect x="115" y="115" width="5" height="5" fill="black" />

            <!-- Data Blocks -->
            <rect x="55" y="35" width="10" height="10" fill="black" />
            <rect x="75" y="35" width="15" height="10" fill="black" />
            <rect x="95" y="35" width="10" height="10" fill="black" />
            <rect x="55" y="55" width="15" height="10" fill="black" />
            <rect x="80" y="55" width="10" height="15" fill="black" />
            <rect x="100" y="55" width="15" height="10" fill="black" />
            <rect x="125" y="55" width="10" height="10" fill="black" />
            <rect x="140" y="55" width="10" height="10" fill="black" />
            
            <rect x="35" y="65" width="10" height="15" fill="black" />
            <rect x="55" y="75" width="10" height="15" fill="black" />
            <rect x="75" y="75" width="15" height="10" fill="black" />
            <rect x="100" y="75" width="10" height="10" fill="black" />
            <rect x="120" y="75" width="10" height="10" fill="black" />
            <rect x="135" y="75" width="15" height="10" fill="black" />

            <rect x="35" y="90" width="10" height="10" fill="black" />
            <rect x="55" y="95" width="15" height="10" fill="black" />
            <rect x="75" y="95" width="10" height="15" fill="black" />
            <rect x="90" y="95" width="10" height="10" fill="black" />
            <rect x="135" y="95" width="15" height="10" fill="black" />

            <rect x="55" y="115" width="10" height="15" fill="black" />
            <rect x="70" y="115" width="10" height="10" fill="black" />
            <rect x="85" y="115" width="15" height="10" fill="black" />
            <rect x="135" y="115" width="15" height="10" fill="black" />

            <rect x="55" y="135" width="15" height="10" fill="black" />
            <rect x="75" y="135" width="10" height="10" fill="black" />
            <rect x="90" y="135" width="15" height="10" fill="black" />
            <rect x="110" y="135" width="10" height="10" fill="black" />
            <rect x="130" y="135" width="15" height="10" fill="black" />
          </svg>
        </div>

        <!-- Details Grid -->
        <div class="details-list">
          <div class="detail-item">
            <span class="detail-label">${labels.beneficiary}</span>
            <span class="detail-value">Ecram Execs B.V.</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">${labels.iban}</span>
            <span class="detail-value">
              <span id="iban-val">NL91 ABNA 0417 1643 00</span>
              <button type="button" class="copy-pill" onclick="copyText('iban-val', this)">${labels.copy}</button>
            </span>
          </div>
          <div class="detail-item">
            <span class="detail-label">${labels.amount}</span>
            <span class="detail-value">${totalFormatted}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">${labels.paymentRef}</span>
            <span class="detail-value">
              <span id="ref-val">${invoiceNumber}</span>
              <button type="button" class="copy-pill" onclick="copyText('ref-val', this)">${labels.copy}</button>
            </span>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="close-btn" onclick="closeQrModal()">${labels.close}</button>
      </div>
    </div>
  </div>

  <script>
    function unlockInvoice() {
      const box = document.getElementById('access-box');
      const details = document.getElementById('invoice-details');
      if (box) box.style.display = 'none';
      if (details) details.classList.add('active');
    }

    // Auto-advance digit inputs
    const inputs = document.querySelectorAll('.code-digit');
    inputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (input.value && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
        const code = Array.from(inputs).map(i => i.value).join('');
        if (code.length === 5) {
          unlockInvoice();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && index > 0) {
          inputs[index - 1].focus();
        }
      });
    });

    function openQrModal() {
      document.getElementById('qr-modal').classList.add('active');
    }

    function closeQrModal(e) {
      if (!e || e.target === document.getElementById('qr-modal')) {
        document.getElementById('qr-modal').classList.remove('active');
      }
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeQrModal();
    });

    function copyText(elementId, btn) {
      const text = document.getElementById(elementId).innerText.trim();
      navigator.clipboard.writeText(text).then(() => {
        const original = btn.innerText;
        btn.innerText = "${labels.copied}";
        btn.style.background = "#dcfce7";
        btn.style.color = "#15803d";
        setTimeout(() => {
          btn.innerText = original;
          btn.style.background = "";
          btn.style.color = "";
        }, 2000);
      });
    }
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        ...NO_CACHE_HEADERS,
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    console.error("[mock/moneybird/invoice] unhandled error", err);
    return new NextResponse("<!DOCTYPE html><html><body><h2>Moneybird Preview</h2><p>Mock invoice available.</p></body></html>", {
      status: 200,
      headers: { ...NO_CACHE_HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
