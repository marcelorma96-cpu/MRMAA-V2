/** Display only: the saved status already reflects confirmation/conversion. */
export function quoteDocumentLabels(status: string, language: string) {
  const confirmed = status === "confirmada" || status === "convertida";
  const en = language === "en";
  return {
    title: confirmed
      ? (en ? "CONFIRMED QUOTE" : "COTIZACIÓN CONFIRMADA")
      : (en ? "QUOTE" : "COTIZACIÓN"),
    subtitle: confirmed
      ? (en ? "Event details" : "Detalles del evento")
      : (en ? "Event proposal" : "Propuesta para evento"),
  };
}
