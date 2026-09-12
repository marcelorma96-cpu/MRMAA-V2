import { LegalPage, LegalSection } from "@/components/legal-page";

export default function DataProcessingPage() {
  return <LegalPage title="Acuerdo de tratamiento de datos" intro="Condiciones básicas bajo las cuales MRMAA procesa datos por cuenta del restaurante contratante.">
    <LegalSection title="Objeto e instrucciones"><p>MYM S.A. procesará los datos personales cargados por el cliente únicamente para prestar MRMAA, conforme al contrato, configuración del cliente e instrucciones documentadas lícitas.</p></LegalSection>
    <LegalSection title="Personas y datos"><p>El tratamiento puede comprender datos de clientes, prospectos, empleados y usuarios; datos identificativos, contacto, reservaciones, preferencias operativas, cotizaciones, horarios y registros de actividad. No deben cargarse datos sensibles innecesarios.</p></LegalSection>
    <LegalSection title="Confidencialidad y seguridad"><p>MYM S.A. limitará el acceso a personas y proveedores que lo necesiten, aplicará controles razonables y mantendrá obligaciones de confidencialidad. El cliente administrará roles, credenciales y legitimidad de la información.</p></LegalSection>
    <LegalSection title="Subencargados"><p>El cliente autoriza el uso de proveedores necesarios de infraestructura, autenticación, comunicaciones y pagos. MYM S.A. mantendrá obligaciones apropiadas con dichos proveedores y comunicará cambios materiales cuando corresponda.</p></LegalSection>
    <LegalSection title="Asistencia"><p>MRMAA brindará asistencia razonable para responder solicitudes de derechos, investigar incidentes y exportar o eliminar información, considerando la naturaleza del servicio y la información disponible.</p></LegalSection>
    <LegalSection title="Finalización"><p>Al terminar el servicio, el cliente podrá exportar información durante el plazo aplicable. Después, los datos se eliminarán o anonimizarán conforme a la política de retención, excepto cuando una obligación legal exija conservarlos.</p></LegalSection>
  </LegalPage>;
}
