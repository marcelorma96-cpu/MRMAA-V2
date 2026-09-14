import { LegalPage, LegalSection } from "@/components/legal-page";

export default function SubscriptionsPage() {
  return <LegalPage title="Suscripciones, cancelaciones y reembolsos" intro="Reglas comerciales aplicables a pruebas y planes pagados de MRMAA.">
    <LegalSection title="Prueba"><p>La prueba vigente se muestra al activarla. No se realizará un cobro automático si el cliente no proporcionó un método de pago y autorizó claramente la renovación.</p></LegalSection>
    <LegalSection title="Cobros"><p>Antes de confirmar se mostrará el plan, precio total, moneda, periodicidad, impuestos conocidos y próxima fecha de cobro. El cliente autoriza al procesador de pagos a efectuar cargos recurrentes hasta la cancelación.</p></LegalSection>
    <LegalSection title="Cancelación"><p>El administrador podrá cancelar desde la cuenta cuando la función esté habilitada o mediante soporte. La cancelación será tan accesible como la contratación y detendrá cargos posteriores; no elimina inmediatamente los datos.</p></LegalSection>
    <LegalSection title="Reembolsos"><p>Salvo error de cobro, duplicidad, indisponibilidad sustancial atribuible a MRMAA o derecho obligatorio aplicable, los períodos ya iniciados no son reembolsables. Las solicitudes se evaluarán de buena fe y no limitan derechos legales irrenunciables.</p></LegalSection>
    <LegalSection title="Mora"><p>Un pago rechazado puede generar avisos, período de gracia y modo de solo lectura. El cliente dispondrá del plazo mostrado para exportar información antes de una suspensión completa.</p></LegalSection>
  </LegalPage>;
}
