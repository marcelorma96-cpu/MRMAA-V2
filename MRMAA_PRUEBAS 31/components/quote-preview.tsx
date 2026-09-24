"use client";
import { useEffect, useRef, useState } from "react";
import { sizeQuoteColumns } from "@/lib/pdf-pagination";
import { Download, Pencil, Printer } from "lucide-react";
import { calculateQuoteWithAdjustments } from "@/lib/calculations";
import type { Quote, QuoteCustomField } from "@/lib/types";
import { TransparentLogo } from "@/components/transparent-logo";
import { needsNativePdfViewer, reserveQuotePrintWindow } from "@/lib/print";
import { currentAppLanguage, formatAppMoney } from "@/components/app-preferences";
import { translate } from "@/lib/translations";
import { recordAuditActivity } from "@/lib/audit-activity";
import { userMessage } from "@/lib/user-message";
import { formatEventTime } from "@/lib/local-date";
import { displayDate } from "@/components/dashboard-ui";

// Extracted verbatim from components/dashboard.tsx — no behavior change, only
// moved to its own file so it's a separate bundle chunk from the main
// Dashboard shell and can be lazy-loaded independently.

export function QuotePreview({
  restaurantId,
  onOutputBusy,
  canEdit = false,
  quote,
  restaurant,
  settings,
  close,
  edit,
}: {
  restaurantId?: string;
  onOutputBusy?: (busy: boolean) => void;
  canEdit?: boolean;
  quote: Quote;
  restaurant: string;
  settings: any;
  close: () => void;
  edit: () => void;
}) {
  const paperRef = useRef<HTMLElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const outputBusy = useRef(false);
  const [output, setOutput] = useState<"pdf" | "print" | null>(null);
  const [outputError, setOutputError] = useState("");
  const [printUrl, setPrintUrl] = useState("");
  const [printReady, setPrintReady] = useState(false);
  const [fallbackPurpose, setFallbackPurpose] = useState<"pdf" | "print">("print");
  const [paperScale, setPaperScale] = useState(1);
  const [scaledPaperHeight, setScaledPaperHeight] = useState<number>();
  useEffect(() => () => { if (printUrl) URL.revokeObjectURL(printUrl); }, [printUrl]);
  useEffect(() => {
    const paper = paperRef.current;
    const viewport = previewViewportRef.current;
    if (!paper || !viewport) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        sizeQuoteColumns(paper, document);
        const scale = Math.min(1, viewport.clientWidth / 900);
        setPaperScale(scale);
        setScaledPaperHeight(Math.ceil(paper.scrollHeight * scale));
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(paper);
    observer.observe(viewport);
    update();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [quote, settings]);
  async function exportDocument(action: "pdf" | "print") {
    if (outputBusy.current || !paperRef.current) return;
    outputBusy.current = true; onOutputBusy?.(true);
    setOutput(action); setOutputError(""); setPrintReady(false);
    const nativePdfViewer = action === "pdf" && needsNativePdfViewer();
    const printWindow = action === "print" || nativePdfViewer
      ? reserveQuotePrintWindow(`${currentAppLanguage() === "en" ? "Quote" : "Cotizacion"}-${quote.quote_number}`, translate("Preparando documento…", currentAppLanguage()))
      : null;
    try {
      const { downloadQuotePreviewPdf, printQuotePreview } = await import("@/lib/pdf");
      if (action === "pdf") {
        const result = await downloadQuotePreviewPdf(paperRef.current, quote.quote_number, printWindow, nativePdfViewer);
        if (nativePdfViewer) {
          setFallbackPurpose("pdf");
          setPrintUrl(result.opened ? "" : result.url);
          setPrintReady(true);
        }
      }
      else {
        const result = await printQuotePreview(paperRef.current, quote.quote_number, printWindow);
        setFallbackPurpose("print");
        setPrintUrl(result.opened ? "" : result.url);
        setPrintReady(true);
        void recordAuditActivity(restaurantId, "impresion", "cotizaciones", { quote_id: quote.id, quote_number: quote.quote_number, pages: result.pages });
      }
    } catch {
      printWindow?.close();
      setOutputError(userMessage(null));
    } finally { outputBusy.current = false; onOutputBusy?.(false); setOutput(null); }
  }
  const t = calculateQuoteWithAdjustments(
    quote.items,
    quote.discount_pct,
    quote.tip_pct,
    quote.deposit,
    quote.adjustments || [],
  );
  const quoteMoney = (value: number) => formatAppMoney(value);
  const accent = settings.quote_accent || "#ea580c";
  const textColor = settings.quote_text_color || settings.quote_color || "#18181b";
  const headerColor = settings.quote_header_color || settings.quote_color || "#18181b";
  const middleColor = settings.quote_middle_color || textColor;
  const middleTextColor = contrastingTextColor(middleColor);
  const headerTextColor = contrastingTextColor(headerColor);
  return (
    <div className="overlay quotePreviewOverlay">
      <div className="quotePreviewShell">
      <div ref={previewViewportRef} className="quotePreviewViewport" style={{ height: scaledPaperHeight ? `${scaledPaperHeight}px` : undefined }}>
      <section
        ref={paperRef}
        id="quote-preview-paper"
        className={`paper quoteStyle-${settings.quote_style || "moderna"}`}
        style={
          {
            width: "900px", minWidth: "900px", maxWidth: "900px",
            transform: `scale(${paperScale})`, transformOrigin: "top left",
            fontFamily: settings.quote_font || "Georgia",
            color: textColor,
            borderTop: `6px solid ${accent}`,
            "--quote-main": textColor,
            "--quote-accent": accent,
            "--quote-header": headerColor,
            "--quote-header-text": headerTextColor,
            "--quote-soft": hexToRgba(accent, 0.075),
            "--quote-middle": middleColor,
            "--quote-middle-text": middleTextColor,
          } as React.CSSProperties
        }
      >
        <header>
          <div className="quoteHeaderIdentity">
            {settings.logo_data_url && (
              <TransparentLogo
                className="quoteLogo"
                src={settings.logo_data_url}
                alt={`Logo de ${restaurant}`}
              />
            )}
            <div>
              <small>{restaurant}</small>
              <h2>COTIZACIÓN</h2>
              <p>Propuesta para evento</p>
              <div className="quoteBusinessDetails">
                {settings.business_address && (
                  <span>{settings.business_address}</span>
                )}
                {settings.business_country && (
                  <span>{settings.business_country}</span>
                )}
                {settings.business_email && (
                  <span>{settings.business_email}</span>
                )}
                {settings.business_phone && (
                  <span>{settings.business_phone}</span>
                )}
              </div>
            </div>
          </div>
          <strong>#{quote.quote_number}</strong>
        </header>
        <div className="quoteInfo">
          {settings.quote_show_client_name !== false && (
            <span>
              <small>Cliente</small>
              {quote.client_name}
            </span>
          )}
          {settings.quote_show_client_email !== false && quote.client_email && (
            <span>
              <small>Email</small>
              {quote.client_email}
            </span>
          )}
          {settings.quote_show_event_date !== false && (
            <span>
              <small>Fecha</small>
              {displayDate(quote.event_date)}
            </span>
          )}
          {settings.quote_show_event_time !== false && (
            <span>
              <small>Hora</small>
              {formatEventTime(quote.event_time, settings.time_format)}
            </span>
          )}
          {settings.quote_show_area !== false && (
            <span>
              <small>Área</small>
              {quote.area || "—"}
            </span>
          )}
          {settings.quote_show_guests !== false && (
            <span>
              <small>Invitados</small>
              {quote.guests}
            </span>
          )}
          {settings.quote_show_client_phone !== false && (
            <span>
              <small>Teléfono</small>
              {quote.client_phone || "—"}
            </span>
          )}
          {(settings.quote_custom_client_fields || [])
            .filter((x: QuoteCustomField) => x.active !== false)
            .map((custom: QuoteCustomField) => {
              const value = quote.custom_fields?.[custom.id];
              return value ? (
                <span key={custom.id}>
                  <small>{custom.label}</small>
                  {value}
                </span>
              ) : null;
            })}
        </div>
        <div className="previewTable">
          <div>
            <b>Producto / servicio</b>
            <b>Descripción</b>
            <b>Cant.</b>
            <b>Precio</b>
            <b>Total</b>
          </div>
          {quote.items.map((x, i) => (
            <div key={i}>
              <strong>{x.name}</strong>
              <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{x.description || "—"}</span>
              <span>{x.quantity}</span>
              <span>{quoteMoney(x.unit_price)}</span>
              <strong>{quoteMoney(x.quantity * x.unit_price)}</strong>
            </div>
          ))}
        </div>
        <div className="previewTotals">
          <QuotePreviewTotal
            label="Subtotal"
            value={t.subtotal}
            money={quoteMoney}
          />
          {settings.discounts !== false && t.discount > 0 && (
            <QuotePreviewTotal
              label={`Descuento ${t.discountPct}%`}
              value={-t.discount}
              money={quoteMoney}
            />
          )}
          {settings.tips !== false && (
            <QuotePreviewTotal
              label={`Propina ${t.tipPct}%`}
              value={t.tip}
              money={quoteMoney}
            />
          )}
          {t.adjustmentLines.map((line) => (
            <QuotePreviewTotal
              key={line.id}
              label={`${line.label}${line.mode === "percent" ? ` ${line.value}%` : ""}`}
              value={(line.kind === "discount" ? -1 : 1) * line.amount}
              money={quoteMoney}
            />
          ))}
          {settings.quote_show_deposit_view !== false && (
            <>
              <QuotePreviewTotal
                label="Anticipo"
                value={-t.deposit}
                money={quoteMoney}
              />
              {quote.payment_method && (
                <div className="paymentMethod">
                  <span>Método de pago</span>
                  <b>{quote.payment_method}</b>
                </div>
              )}
            </>
          )}
          <QuotePreviewTotal
            big
            label="Saldo pendiente"
            value={t.balance}
            money={quoteMoney}
          />
        </div>
        {settings.quote_show_customer_note !== false && quote.customer_note && (
          <div className="note">
            <strong>Nota para el cliente</strong>
            <p>{quote.customer_note}</p>
          </div>
        )}
      </section>
      </div>
        <footer className="quotePreviewActions" data-html2canvas-ignore="true">
          {outputError && <p role="alert">{outputError}</p>}
          {output && <span role="status">Preparando documento…</span>}
          {!output && printReady && <p className="quotePrintHelp" role="status">{fallbackPurpose === "pdf" ? "Abra el PDF y use Compartir o Guardar en Archivos para conservarlo." : "Use el botón de impresión del PDF si el diálogo no se abre automáticamente. Seleccione Ajustar al área imprimible."}</p>}
          {!output && printUrl && <a className="secondary" href={printUrl} target="_blank" rel="noopener noreferrer">{fallbackPurpose === "pdf" ? "Abrir PDF" : "Abrir PDF para imprimir"}</a>}
          <button type="button" className="secondary" onClick={close} disabled={Boolean(output)}>
            Cerrar
          </button>
          {canEdit && <button type="button" className="secondary" onClick={edit} disabled={Boolean(output)}>
            <Pencil />
            Editar
          </button>}
          <button type="button" className="secondary" disabled={Boolean(output)} onClick={() => void exportDocument("print")}>
            <Printer /> Imprimir
          </button>
          <button
            type="button"
            className="primary"
            disabled={Boolean(output)}
            onClick={() => void exportDocument("pdf")}
          >
            <Download />
            PDF
          </button>
        </footer>
      </div>
    </div>
  );
}
function contrastingTextColor(hex: string) {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return "#ffffff";
  const red = parseInt(normalized.slice(0, 2), 16),
    green = parseInt(normalized.slice(2, 4), 16),
    blue = parseInt(normalized.slice(4, 6), 16),
    luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance > 155 ? "#18181b" : "#ffffff";
}
function QuotePreviewTotal({
  label,
  value,
  money: formatMoney,
  big,
}: {
  label: string;
  value: number;
  money: (value: number) => string;
  big?: boolean;
}) {
  return (
    <div className={big ? "total big" : "total"}>
      <span>{label}</span>
      <strong>{formatMoney(value)}</strong>
    </div>
  );
}
function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(234,88,12,${alpha})`;
  return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`;
}
