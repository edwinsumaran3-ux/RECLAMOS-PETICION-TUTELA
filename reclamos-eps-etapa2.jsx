import { useState, useRef, useEffect, useCallback } from "react";
import { jsPDF } from "jspdf";

// ─────────────────────────────────────────────
// PROMPTS DE LOS 6 AGENTES
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres el asistente inteligente de una plataforma de reclamaciones ante EPS en Colombia. Orquestas 6 agentes internos para ayudar al usuario a preparar su reclamo con pleno rigor jurídico. Actúas con tono humano, empático, claro y profesional.

FLUJO DIRECTO — Máximo 4 intercambios antes de generar el documento. SIN rodeos:

1. Saluda brevemente y pregunta en UN SOLO MENSAJE:
   "¿Cuál es tu EPS, qué problema tienes y cuánto tiempo llevas esperando?"

2. Con la respuesta, pregunta en UN SOLO MENSAJE:
   "Dame tu nombre completo, número de cédula y correo electrónico. ¿Qué quieres que haga la EPS?"

3. Si hay urgencia CRÍTICA (síntomas graves, riesgo vital): di "⚠️ Esto puede ser urgencia médica. Ve a urgencias ahora. Mientras tanto preparo tu documento." y continúa.

4. GENERA EL DOCUMENTO INMEDIATAMENTE con la información disponible. No hagas más preguntas innecesarias.
   - Después de generarlo di: "Tu documento está listo. Usa el panel de abajo para enviarlo directamente a tu EPS o escalar a Supersalud."

EVALUACIÓN DE URGENCIA (para determinar tipo de documento):
   - CRÍTICO: síntomas graves, riesgo vital, ideación suicida
   - ALTO: menor de edad, adulto mayor, embarazo, discapacidad, tratamiento interrumpido
   - MEDIO: demora prolongada, falta de respuesta
   - BAJO: trámite administrativo sin riesgo

CLASIFICACIÓN del documento:
   - PQRS: casos simples, primeras reclamaciones
   - DERECHO DE PETICIÓN: demoras superiores a 3 días hábiles, sin respuesta, o negativa de servicios del PBS
   - SOLICITUD PRIORITARIA: urgencia ALTA, pacientes vulnerables (menores, adultos mayores, embarazadas, personas con discapacidad)
   - TUTELA PRELIMINAR (borrador): urgencia crítica, derechos fundamentales vulnerados, salud como derecho fundamental (Ley 1751/2015)

4. MARCO JURÍDICO — aplica las normas correspondientes según el caso concreto:

   PQRS / Servicio general:
   - Artículo 49 Constitución Política de Colombia (derecho a la salud y a la seguridad social)
   - Ley 100 de 1993 (Sistema General de Seguridad Social en Salud — obligaciones de las EPS)
   - Ley 1438 de 2011 (reforma al SGSSS — derechos y deberes del afiliado, Art. 10)
   - Resolución 1552 de 2013 del Ministerio de Salud (tiempos máximos de espera: 3 días hábiles para medicina general, 15 días para especialista)
   - Circular 047 de 2007 Supersalud (obligaciones de atención y servicio al usuario)

   DERECHO DE PETICIÓN:
   - Artículo 23 Constitución Política de Colombia (derecho fundamental de petición)
   - Ley 1755 de 2015, Arts. 13 al 33 CPACA (derecho de petición ante organizaciones privadas que presten servicios públicos)
   - Art. 14 Ley 1755/2015: la EPS debe dar respuesta de fondo en 15 días hábiles
   - Art. 49 Constitución Política de Colombia
   - Ley 100 de 1993, Art. 153 (principios del SGSSS: calidad, oportunidad, eficiencia)

   MEDICAMENTOS / TECNOLOGÍAS EN SALUD:
   - Resolución 5592 de 2015 y sus modificaciones (Plan de Beneficios en Salud — PBS)
   - Ley 1751 de 2015, Art. 10 lit. f (garantías del derecho a la salud: oportunidad, continuidad, integralidad)
   - Ley 1751 de 2015, Art. 15 (prohibición de negar, suspender o interrumpir servicios incluidos en el PBS)
   - Sentencia T-760 de 2008 Corte Constitucional (salud como derecho fundamental autónomo; obligaciones de las EPS)
   - Sentencia SU-819 de 1999 Corte Constitucional (principio de continuidad del tratamiento médico)

   TUTELA:
   - Artículo 86 Constitución Política de Colombia (acción de tutela para proteger derechos fundamentales)
   - Decreto 2591 de 1991 (reglamentación de la acción de tutela — fallo dentro de los 10 días siguientes)
   - Ley 1751 de 2015 (Ley Estatutaria de Salud — salud como derecho fundamental)
   - Sentencia T-760 de 2008 Corte Constitucional (reglas sobre acceso a servicios de salud)
   - Art. 49 y 86 Constitución Política de Colombia
   - Principio de continuidad e integralidad del servicio de salud

   CIRUGÍAS / PROCEDIMIENTOS ELECTIVOS:
   - Ley 1751 de 2015, Art. 8 (continuidad en la prestación del servicio de salud)
   - Ley 1438 de 2011, Art. 67 (tiempos de espera en listas quirúrgicas)
   - Plan de Beneficios en Salud vigente (PBS — Resolución 5592/2015)
   - Decreto 780 de 2016 (Decreto Único Reglamentario del Sector Salud)

   INCAPACIDADES LABORALES:
   - Art. 227 Código Sustantivo del Trabajo (auxilio por enfermedad)
   - Decreto 1406 de 1999 (liquidación y pago de incapacidades)
   - Arts. 206 y 207 Ley 100 de 1993 (licencias por enfermedad — obligación de la EPS)

   PACIENTES VULNERABLES (menores, adultos mayores, embarazadas, personas con discapacidad):
   - Art. 44 Constitución Política (derechos fundamentales de los niños — prevalencia sobre derechos de los demás)
   - Art. 46 Constitución Política (protección especial al adulto mayor)
   - Art. 43 Constitución Política (protección de la mujer en estado de embarazo y lactancia)
   - Ley 1751 de 2015, Art. 6 (elementos esenciales: atención prioritaria a sujetos de especial protección constitucional)

5. REDACCIÓN: Cuando tengas suficiente información, ofrece generar el documento. Usa este formato exacto al redactar:

---DOCUMENTO_INICIO---
TIPO: [PQRS / DERECHO DE PETICIÓN / SOLICITUD PRIORITARIA / TUTELA PRELIMINAR]
CIUDAD_FECHA: [Ciudad], [fecha actual]
DESTINATARIO: [Nombre de la EPS — Defensoría del Usuario / Gerencia / dependencia correspondiente]
ASUNTO: [Asunto claro y concreto]
SOLICITANTE_NOMBRE: [Nombre completo]
SOLICITANTE_DOC: [Tipo y número de documento]
SOLICITANTE_CONTACTO: [Teléfono / correo / dirección para notificaciones]
HECHOS:
[Lista numerada de hechos en orden cronológico, con fechas precisas y descripción detallada]
FUNDAMENTOS_DE_DERECHO:
[Lista numerada de normas aplicables: artículo, ley y su relevancia concreta para este caso]
SOLICITUDES:
[Lista numerada de solicitudes concretas, medibles y con plazo explícito]
ADVERTENCIA_LEGAL:
[Consecuencias jurídicas del incumplimiento: sanciones Supersalud, posibilidad de acción de tutela, denuncia ante el Ministerio de Salud]
ANEXOS:
[Lista de documentos que se adjuntan o deben adjuntarse para sustentar el reclamo]
SIGUIENTE_PASO: [Acción concreta si no hay respuesta oportuna, incluyendo entidad ante la que se puede escalar]
---DOCUMENTO_FIN---

6. SEGUIMIENTO: Después de generar el documento, informa:
   - Plazo legal de respuesta según tipo:
     * PQRS: 15 días hábiles
     * Derecho de Petición: 15 días hábiles (Art. 14 Ley 1755/2015)
     * Solicitud Prioritaria: 10 días hábiles
     * Tutela: fallo en 10 días calendario (Art. 29 Decreto 2591/1991)
   - Dónde radicar: presencial en oficinas de la EPS, correo certificado, plataforma virtual de la EPS, o Supersalud (www.supersalud.gov.co — línea gratuita 018000-513700)
   - Qué hacer si no hay respuesta oportuna

REGLAS ABSOLUTAS:
- Nunca inventes datos. Usa [DATO PENDIENTE] cuando falte información.
- Cita SIEMPRE al menos 3 normas jurídicas vigentes y aplicables al caso concreto del usuario.
- Nunca presentes el documento como definitivo. Siempre pide confirmación al usuario antes de finalizar.
- No des diagnósticos médicos ni asesoría jurídica definitiva.
- Protege la privacidad: trata todos los datos como confidenciales.
- Usa lenguaje jurídico colombiano formal y directo: "me permito elevar ante usted", "con fundamento en las normas vigentes", "respetuosamente solicito", "al tenor de lo dispuesto en".
- Al final del documento incluye siempre: "Este documento es un borrador generado con apoyo tecnológico y debe ser revisado por el usuario antes de su radicación."`;


// PROMPT DEL AGENTE DOCUMENTAL (Etapa 2)
const AGENTE_DOCUMENTAL_PROMPT = `Eres el Agente Documental de una plataforma de reclamaciones ante EPS en Colombia.
Tu función es analizar documentos médicos y administrativos (órdenes médicas, fórmulas, autorizaciones, respuestas de EPS, historias clínicas, incapacidades, exámenes) para extraer la información necesaria para construir un reclamo.

Analiza el documento proporcionado y devuelve ÚNICAMENTE un bloque JSON con este formato exacto, sin texto adicional, sin comillas de bloque markdown:

---EXTRACCION_INICIO---
{
  "tipo_documento": "[Tipo: orden médica / fórmula / autorización / respuesta EPS / historia clínica / incapacidad / examen / otro]",
  "fecha_documento": "[Fecha que aparece en el documento o 'No identificado']",
  "nombre_paciente": "[Nombre completo o 'No identificado']",
  "tipo_doc_paciente": "[Tipo de documento: CC, TI, CE, etc. o 'No identificado']",
  "numero_doc_paciente": "[Número de documento o 'No identificado']",
  "eps": "[Nombre de la EPS o 'No identificado']",
  "ips_medico": "[IPS, clínica, hospital o nombre del médico que emite o 'No identificado']",
  "ciudad": "[Ciudad o 'No identificado']",
  "servicio_solicitado": "[Cita, medicamento, procedimiento, examen, especialidad solicitada o 'No identificado']",
  "diagnostico": "[Diagnóstico o código CIE-10 si aparece, solo si es relevante para el reclamo, o 'No identificado']",
  "numero_radicado": "[Número de radicado, autorización u orden o 'No identificado']",
  "respuesta_eps": "[Texto de respuesta de la EPS si existe o 'No identificado']",
  "fecha_respuesta_eps": "[Fecha de respuesta de la EPS o 'No identificado']",
  "observaciones": "[Observaciones importantes para el reclamo]",
  "datos_faltantes": "[Lista de datos que no se encontraron y son importantes para el reclamo]",
  "resumen_para_reclamo": "[Resumen en 2-3 líneas de lo que muestra este documento y cómo apoya el reclamo]"
}
---EXTRACCION_FIN---

REGLAS:
- Nunca inventes datos. Si no aparece, escribe "No identificado".
- No incluyas información médica sensible que no sea necesaria para el reclamo.
- Si el documento es ilegible o no es relevante para EPS, indícalo en observaciones.
- Extrae fechas en formato DD/MM/AAAA cuando sea posible.`;

// ─────────────────────────────────────────────
// BASE DE DATOS EPS Y ORGANISMOS COLOMBIA
// ─────────────────────────────────────────────
const EPS_DATABASE = {
  "Sura": { email: "pqrs@sura.com", portal: "https://www.sura.com/salud", telefono: "018000-052-052", pqrsPortal: "https://www.sura.com/salud/Pages/Salud.aspx" },
  "EPS Sura": { email: "pqrs@sura.com", portal: "https://www.sura.com/salud", telefono: "018000-052-052", pqrsPortal: "https://www.sura.com/salud" },
  "Sanitas": { email: "peticion@sanitas.com.co", portal: "https://www.sanitas.com.co", telefono: "018000-510-033", pqrsPortal: "https://www.sanitas.com.co" },
  "Compensar": { email: "peticion@compensar.com", portal: "https://www.compensar.com", telefono: "018000-112-114", pqrsPortal: "https://www.compensar.com/salud/pqrs.aspx" },
  "Nueva EPS": { email: "nuevaeps@nuevaeps.com.co", portal: "https://www.nuevaeps.com.co", telefono: "018000-910-097", pqrsPortal: "https://www.nuevaeps.com.co" },
  "Coosalud": { email: "servicioalcliente@coosalud.com.co", portal: "https://www.coosalud.com.co", telefono: "018000-180-080", pqrsPortal: "https://www.coosalud.com.co" },
  "Medimás": { email: "quejasyreclamos@medimas.com.co", portal: "https://www.medimas.com.co", telefono: "018000-120-808", pqrsPortal: "https://www.medimas.com.co" },
  "Famisanar": { email: "pqrs@famisanar.com.co", portal: "https://www.famisanar.com.co", telefono: "601-742-6060", pqrsPortal: "https://www.famisanar.com.co" },
  "Salud Total": { email: "servicioalcliente@saludtotal.com.co", portal: "https://www.saludtotal.com.co", telefono: "018000-912-912", pqrsPortal: "https://www.saludtotal.com.co" },
  "Coomeva": { email: "servicioalcliente@coomeva.com.co", portal: "https://www.coomeva.com.co", telefono: "018000-916-161", pqrsPortal: "https://www.coomeva.com.co" },
  "Mutual SER": { email: "servicioalcliente@mutualser.com.co", portal: "https://www.mutualser.com.co", telefono: "018000-120-808", pqrsPortal: "https://www.mutualser.com.co" },
  "Aliansalud": { email: "servicioalcliente@aliansalud.com.co", portal: "https://www.aliansalud.com.co", telefono: "018000-519-519", pqrsPortal: "https://www.aliansalud.com.co" },
  "Cajacopi": { email: "atencionusuario@cajacopi.com.co", portal: "https://www.cajacopi.com.co", telefono: "605-330-0500", pqrsPortal: "https://www.cajacopi.com.co" },
  "Emssanar": { email: "servicioalcliente@emssanar.com.co", portal: "https://www.emssanar.com.co", telefono: "018000-510-010", pqrsPortal: "https://www.emssanar.com.co" },
  "Asmet Salud": { email: "asmet@asmet.co", portal: "https://www.asmet.co", telefono: "018000-510-800", pqrsPortal: "https://www.asmet.co" },
  "Comfenalco Valle": { email: "servicioalcliente@comfenalcovalle.com.co", portal: "https://www.comfenalcovalle.com.co", telefono: "018000-180-500", pqrsPortal: "https://www.comfenalcovalle.com.co" },
  "SOS Salud": { email: "servicioalcliente@sos-salud.com.co", portal: "https://www.sos-salud.com.co", telefono: "018000-912-120", pqrsPortal: "https://www.sos-salud.com.co" },
};

const SUPERSALUD = {
  nombre: "Superintendencia Nacional de Salud",
  email: "supersalud@supersalud.gov.co",
  portal: "https://www.supersalud.gov.co",
  pqrdPortal: "https://www.supersalud.gov.co/es-co/supersalud/radique-su-pqrd",
  telefono: "018000-513-700",
  descripcion: "Ente de control. Radica aquí si la EPS no responde o vulnera tus derechos.",
};

const DEFENSORIA = {
  nombre: "Defensoría del Pueblo",
  portal: "https://www.defensoria.gov.co",
  telefono: "018000-914-814",
  descripcion: "Puede interponer tutela gratuitamente en tu nombre.",
};

function detectarEPS(destinatario) {
  if (!destinatario) return null;
  const d = destinatario.toLowerCase();
  return Object.keys(EPS_DATABASE).find(k => d.includes(k.toLowerCase())) || null;
}

// ─────────────────────────────────────────────
// GENERACIÓN DE PDF
// ─────────────────────────────────────────────
function generatePDF(doc) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 22;
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed = 10) => {
    if (y + needed > pageH - margin) { pdf.addPage(); y = margin; }
  };

  const addLine = (text, size = 10, bold = false, color = [30, 30, 30], indent = 0) => {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text || "", contentW - indent);
    checkPage(lines.length * size * 0.42 + 2);
    pdf.text(lines, margin + indent, y);
    y += lines.length * size * 0.42 + 1;
  };

  const addSection = (title, content, color = [45, 140, 94]) => {
    if (!content || !content.trim()) return;
    y += 4;
    checkPage(14);
    pdf.setFillColor(...color);
    pdf.roundedRect(margin, y - 4, contentW, 7, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(255, 255, 255);
    pdf.text(title, margin + 3, y);
    y += 6;
    addLine(content, 10, false, [40, 40, 40]);
  };

  // Encabezado con fondo
  pdf.setFillColor(45, 140, 94);
  pdf.rect(0, 0, pageW, 22, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.setTextColor(255, 255, 255);
  pdf.text(doc.tipo || "DOCUMENTO EPS", margin, 10);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Plataforma de Reclamaciones EPS Colombia", margin, 16);
  y = 28;

  addLine(doc.ciudadFecha || "", 10, false, [100, 100, 100]);
  y += 3;
  addLine("Señores", 10, true);
  addLine(doc.destinatario || "", 10, false, [30, 30, 30]);
  addLine("Ciudad", 10);
  y += 3;
  addLine(`ASUNTO: ${doc.asunto || ""}`, 11, true, [30, 30, 30]);
  y += 3;
  const intro = `Yo, ${doc.solicitanteNombre || "[NOMBRE]"}, identificado(a) con ${doc.solicitanteDoc || "[DOCUMENTO]"}, con contacto ${doc.solicitanteContacto || "[CONTACTO]"}, me permito elevar ante ustedes la siguiente reclamación con fundamento en las normas vigentes:`;
  addLine(intro, 10, false, [50, 50, 50]);

  addSection("I.  HECHOS", doc.hechos, [45, 140, 94]);
  addSection("II.  FUNDAMENTOS DE DERECHO", doc.fundamentosDerecho, [74, 63, 140]);
  addSection("III.  SOLICITUDES", doc.solicitudes, [45, 140, 94]);
  addSection("IV.  ADVERTENCIA LEGAL", doc.advertenciaLegal, [180, 100, 0]);
  addSection("V.  DOCUMENTOS ANEXOS", doc.anexos, [45, 140, 94]);

  if (doc.siguientePaso) {
    y += 3;
    addLine("Siguiente paso recomendado:", 10, true, [180, 100, 0]);
    addLine(doc.siguientePaso, 10, false, [100, 70, 0]);
  }

  y += 10;
  checkPage(30);
  addLine("Atentamente,", 10);
  y += 8;
  addLine(doc.solicitanteNombre || "[NOMBRE]", 11, true);
  addLine(doc.solicitanteDoc || "", 10);
  if (doc.solicitanteContacto) addLine(doc.solicitanteContacto, 10);

  // Pie de página en todas las páginas
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setTextColor(160, 160, 160);
    pdf.text("Este documento es un borrador generado con apoyo tecnológico. Debe ser revisado por el usuario antes de su radicación.", margin, pageH - 8);
    pdf.text(`Página ${i} de ${totalPages}`, pageW - margin - 18, pageH - 8);
  }

  pdf.save(`reclamo-eps-${Date.now()}.pdf`);
}

function handleEnviarEPS(doc) {
  generatePDF(doc);
  const epsKey = detectarEPS(doc.destinatario);
  const epsInfo = epsKey ? EPS_DATABASE[epsKey] : null;
  const to = epsInfo?.email || "";
  const subject = encodeURIComponent(`${doc.tipo || "PQRS"} - ${doc.solicitanteNombre || ""} - ${doc.solicitanteDoc || ""}`);
  const body = encodeURIComponent(
    `Señores ${doc.destinatario || "EPS"},\n\n` +
    `ASUNTO: ${doc.asunto || ""}\n\n` +
    `${doc.solicitanteNombre || ""}, ${doc.solicitanteDoc || ""}, ${doc.solicitanteContacto || ""}\n\n` +
    `Adjunto el documento en PDF con los hechos y fundamentos de derecho completos.\n\n` +
    `Solicito respuesta en los plazos legales establecidos.\n\nAtentamente,\n${doc.solicitanteNombre || ""}`
  );
  setTimeout(() => { window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self"); }, 600);
}

// ─────────────────────────────────────────────
// UTILIDADES
// ─────────────────────────────────────────────

function parseDocument(text) {
  const start = text.indexOf("---DOCUMENTO_INICIO---");
  const end = text.indexOf("---DOCUMENTO_FIN---");
  if (start === -1 || end === -1) return null;
  const raw = text.slice(start + 22, end).trim();
  const get = (key) => {
    const regex = new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s");
    const m = raw.match(regex);
    return m ? m[1].trim() : "";
  };
  return {
    tipo: get("TIPO"),
    ciudadFecha: get("CIUDAD_FECHA"),
    destinatario: get("DESTINATARIO"),
    asunto: get("ASUNTO"),
    solicitanteNombre: get("SOLICITANTE_NOMBRE"),
    solicitanteDoc: get("SOLICITANTE_DOC"),
    solicitanteContacto: get("SOLICITANTE_CONTACTO"),
    hechos: get("HECHOS"),
    fundamentosDerecho: get("FUNDAMENTOS_DE_DERECHO"),
    solicitudes: get("SOLICITUDES"),
    advertenciaLegal: get("ADVERTENCIA_LEGAL"),
    anexos: get("ANEXOS"),
    siguientePaso: get("SIGUIENTE_PASO"),
  };
}

function parseExtraccion(text) {
  const start = text.indexOf("---EXTRACCION_INICIO---");
  const end = text.indexOf("---EXTRACCION_FIN---");
  if (start === -1 || end === -1) return null;
  try {
    const raw = text.slice(start + 23, end).trim();
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stripDocument(text) {
  let t = text;
  const ds = t.indexOf("---DOCUMENTO_INICIO---");
  const de = t.indexOf("---DOCUMENTO_FIN---");
  if (ds !== -1 && de !== -1) t = (t.slice(0, ds) + t.slice(de + 19)).trim();
  const es = t.indexOf("---EXTRACCION_INICIO---");
  const ee = t.indexOf("---EXTRACCION_FIN---");
  if (es !== -1 && ee !== -1) t = (t.slice(0, es) + t.slice(ee + 20)).trim();
  return t;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getMediaType(file) {
  if (file.type === "application/pdf") return "application/pdf";
  if (file.type.startsWith("image/")) return file.type;
  return "image/jpeg";
}

function formatExtraccionParaChat(ext) {
  if (!ext) return "";
  const fields = [
    ["📄 Tipo de documento", ext.tipo_documento],
    ["📅 Fecha", ext.fecha_documento],
    ["👤 Paciente", ext.nombre_paciente],
    ["🪪 Documento", ext.numero_doc_paciente !== "No identificado" ? `${ext.tipo_doc_paciente} ${ext.numero_doc_paciente}` : "No identificado"],
    ["🏥 EPS", ext.eps],
    ["🏨 IPS / Médico", ext.ips_medico],
    ["📍 Ciudad", ext.ciudad],
    ["💊 Servicio solicitado", ext.servicio_solicitado],
    ["🔢 Radicado / Orden", ext.numero_radicado],
    ["📝 Respuesta EPS", ext.respuesta_eps],
  ];
  const lines = fields
    .filter(([, v]) => v && v !== "No identificado")
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return lines + (ext.resumen_para_reclamo ? `\n\n📋 ${ext.resumen_para_reclamo}` : "");
}

// ─────────────────────────────────────────────
// COMPONENTES
// ─────────────────────────────────────────────

function ExtraccionCard({ ext }) {
  const fields = [
    ["Tipo", ext.tipo_documento],
    ["Fecha", ext.fecha_documento],
    ["Paciente", ext.nombre_paciente],
    ["Documento", ext.numero_doc_paciente !== "No identificado" ? `${ext.tipo_doc_paciente} ${ext.numero_doc_paciente}` : null],
    ["EPS", ext.eps],
    ["IPS / Médico", ext.ips_medico],
    ["Ciudad", ext.ciudad],
    ["Servicio", ext.servicio_solicitado],
    ["Diagnóstico", ext.diagnostico],
    ["Radicado", ext.numero_radicado],
    ["Respuesta EPS", ext.respuesta_eps],
    ["Fecha respuesta", ext.fecha_respuesta_eps],
  ].filter(([, v]) => v && v !== "No identificado");

  return (
    <div style={{
      background: "linear-gradient(135deg, #f0f4ff 0%, #e8f4fd 100%)",
      border: "1.5px solid #4a6fa5",
      borderRadius: 14,
      padding: "16px 20px",
      marginTop: 10,
      fontSize: 13,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{
          background: "#4a6fa5", color: "#fff", fontSize: 10, fontWeight: 700,
          padding: "3px 10px", borderRadius: 20, letterSpacing: 1,
        }}>DOCUMENTO ANALIZADO</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 10 }}>
        {fields.map(([k, v]) => (
          <div key={k}>
            <span style={{ color: "#4a6fa5", fontWeight: 700 }}>{k}:</span>{" "}
            <span style={{ color: "#1a1a1a" }}>{v}</span>
          </div>
        ))}
      </div>
      {ext.resumen_para_reclamo && (
        <div style={{
          background: "#fff", borderRadius: 8, padding: "8px 12px",
          borderLeft: "3px solid #4a6fa5", color: "#333", lineHeight: 1.5, marginTop: 6,
        }}>
          {ext.resumen_para_reclamo}
        </div>
      )}
      {ext.datos_faltantes && ext.datos_faltantes !== "No identificado" && (
        <div style={{
          background: "#fff8e1", borderRadius: 8, padding: "8px 12px",
          marginTop: 8, color: "#7a6000", fontSize: 12,
        }}>
          ⚠️ <strong>Datos faltantes:</strong> {ext.datos_faltantes}
        </div>
      )}
    </div>
  );
}

function PanelEnvio({ doc }) {
  const epsKey = detectarEPS(doc.destinatario);
  const epsInfo = epsKey ? EPS_DATABASE[epsKey] : null;
  const [copiado, setCopiado] = useState(false);

  const copiarEmail = (email) => {
    navigator.clipboard.writeText(email).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); });
  };

  return (
    <div style={{ background: "#f0faf4", border: "1.5px solid #2d8c5e", borderRadius: 14, padding: "16px 18px", marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#2d8c5e", marginBottom: 12 }}>📤 Enviar documento</div>

      {/* Botones principales */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => handleEnviarEPS(doc)} style={{
          background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 9,
          padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: 1,
        }}>
          📧 Enviar al EPS (descarga PDF + abre email)
        </button>
        <button onClick={() => generatePDF(doc)} style={{
          background: "#fff", color: "#2d8c5e", border: "1.5px solid #2d8c5e", borderRadius: 9,
          padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>
          ⬇ Solo PDF
        </button>
      </div>

      {/* Info EPS */}
      {epsInfo ? (
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>📋 Contacto directo — {epsKey}</div>
          <div style={{ display: "grid", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#888", width: 60 }}>📧 Email</span>
              <a href={`mailto:${epsInfo.email}`} style={{ color: "#2d8c5e", fontWeight: 600 }}>{epsInfo.email}</a>
              <button onClick={() => copiarEmail(epsInfo.email)} style={{ background: "none", border: "1px solid #dde8e0", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#888" }}>{copiado ? "✓" : "Copiar"}</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#888", width: 60 }}>📞 Tel</span>
              <span style={{ color: "#333" }}>{epsInfo.telefono}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#888", width: 60 }}>🌐 Portal</span>
              <a href={epsInfo.pqrsPortal} target="_blank" rel="noreferrer" style={{ color: "#2d8c5e" }}>Radicar en portal EPS →</a>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#7a6000" }}>
          ⚠️ Busca el correo de PQRS de tu EPS en su página oficial para enviarlo.
        </div>
      )}

      {/* Escalamiento */}
      <div style={{ borderTop: "1px solid #c8e6d4", paddingTop: 10, marginTop: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>ESCALAMIENTO (si la EPS no responde)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={SUPERSALUD.pqrdPortal} target="_blank" rel="noreferrer" style={{
            background: "#4a6fa5", color: "#fff", borderRadius: 9, padding: "8px 14px",
            fontSize: 12, fontWeight: 700, textDecoration: "none", flex: 1, textAlign: "center",
          }}>
            🏛 Supersalud (PQRD online)
          </a>
          <a href={`tel:${SUPERSALUD.telefono}`} style={{
            background: "#fff", color: "#4a6fa5", border: "1.5px solid #4a6fa5", borderRadius: 9,
            padding: "8px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none",
          }}>
            📞 {SUPERSALUD.telefono}
          </a>
        </div>
        <a href={DEFENSORIA.portal} target="_blank" rel="noreferrer" style={{
          display: "block", marginTop: 8, background: "#fce8e8", color: "#c0392b",
          borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700,
          textDecoration: "none", textAlign: "center",
        }}>
          ⚖️ Defensoría del Pueblo — Tutela gratuita
        </a>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
        Al hacer clic en "Enviar al EPS": se descarga el PDF y se abre tu cliente de correo con el destinatario y asunto pre-llenados. Solo adjunta el PDF y envía.
      </div>
    </div>
  );
}

function DocumentCard({ doc, onDownload }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #f0f9f4 0%, #e8f4fd 100%)",
      border: "1.5px solid #2d8c5e",
      borderRadius: 16,
      padding: "20px 24px",
      marginTop: 12,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <span style={{
            background: "#2d8c5e", color: "#fff", fontSize: 11, fontWeight: 700,
            padding: "3px 10px", borderRadius: 20, letterSpacing: 1,
          }}>{doc.tipo}</span>
          <div style={{ fontSize: 13, color: "#555", marginTop: 6 }}>{doc.ciudadFecha}</div>
        </div>
        <button onClick={() => generatePDF(doc)} style={{
          background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 8,
          padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600,
        }}>⬇ PDF</button>
      </div>
      <div style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.7 }}>
        <div style={{ marginBottom: 8 }}><strong>Para:</strong> {doc.destinatario}</div>
        <div style={{ marginBottom: 8 }}><strong>Asunto:</strong> {doc.asunto}</div>
        <hr style={{ border: "none", borderTop: "1px solid #c8e6d4", margin: "12px 0" }} />
        <div style={{ marginBottom: 8 }}><strong>Solicitante:</strong> {doc.solicitanteNombre} — {doc.solicitanteDoc}</div>
        {doc.solicitanteContacto && <div style={{ marginBottom: 12 }}><strong>Contacto:</strong> {doc.solicitanteContacto}</div>}
        {doc.hechos && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#2d8c5e" }}>Hechos</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{doc.hechos}</div>
          </div>
        )}
        {doc.fundamentosDerecho && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "#4a3f8c" }}>⚖️ Fundamentos de Derecho</div>
            <div style={{
              background: "#f0f0ff", border: "1px solid #c0b8e8", borderRadius: 8,
              padding: "10px 14px", whiteSpace: "pre-wrap", color: "#2a2060",
              fontSize: 13, lineHeight: 1.65,
            }}>{doc.fundamentosDerecho}</div>
          </div>
        )}
        {doc.solicitudes && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#2d8c5e" }}>Solicitudes</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{doc.solicitudes}</div>
          </div>
        )}
        {doc.advertenciaLegal && (
          <div style={{
            background: "#fff3cd", border: "1px solid #f0ad4e", borderRadius: 8,
            padding: "10px 14px", marginBottom: 12,
          }}>
            <div style={{ fontWeight: 700, color: "#856404", marginBottom: 4 }}>⚠️ Advertencia Legal</div>
            <div style={{ color: "#533f03", fontSize: 13, lineHeight: 1.6 }}>{doc.advertenciaLegal}</div>
          </div>
        )}
        {doc.anexos && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#2d8c5e" }}>Documentos sugeridos para anexar</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{doc.anexos}</div>
          </div>
        )}
        {doc.siguientePaso && (
          <div style={{
            background: "#fff8e1", border: "1px solid #f9c74f", borderRadius: 8,
            padding: "10px 14px", marginTop: 8,
          }}>
            <div style={{ fontWeight: 700, color: "#b8860b", marginBottom: 4 }}>📋 Siguiente paso recomendado</div>
            <div style={{ color: "#555", fontSize: 13 }}>{doc.siguientePaso}</div>
          </div>
        )}
        <div style={{ marginTop: 16, fontSize: 11, color: "#888", fontStyle: "italic", borderTop: "1px solid #c8e6d4", paddingTop: 10 }}>
          Este documento es un borrador generado con apoyo tecnológico y debe ser revisado por el usuario antes de su radicación.
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#2d8c5e",
          animation: "bounce 1.2s ease-in-out infinite",
          animationDelay: `${i * 0.2}s`,
        }} />
      ))}
    </div>
  );
}

function FilePreview({ file, onRemove }) {
  const isImg = file.type.startsWith("image/");
  const url = URL.createObjectURL(file);
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "#f0f9f4", border: "1px solid #c8e6d4",
      borderRadius: 8, padding: "6px 10px", fontSize: 12,
    }}>
      {isImg
        ? <img src={url} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }} />
        : <span style={{ fontSize: 20 }}>📄</span>
      }
      <div style={{ flex: 1, overflow: "hidden" }}>
        <div style={{ fontWeight: 600, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
        <div style={{ color: "#888" }}>{(file.size / 1024).toFixed(0)} KB</div>
      </div>
      <button onClick={onRemove} style={{
        background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 16, padding: 2,
      }}>×</button>
    </div>
  );
}

function MessageBubble({ msg, onDownload }) {
  const isUser = msg.role === "user";
  const doc = !isUser && msg.content ? parseDocument(msg.content) : null;
  const ext = !isUser && msg.content ? parseExtraccion(msg.content) : null;
  const displayText = msg.content ? stripDocument(msg.content) : "";

  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: 16,
      alignItems: "flex-end",
      gap: 8,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "#2d8c5e",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, color: "#fff", flexShrink: 0, fontWeight: 700,
        }}>IA</div>
      )}
      <div style={{ maxWidth: "78%", minWidth: 40 }}>
        {/* Archivo adjunto del usuario */}
        {isUser && msg.fileInfo && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end",
            marginBottom: 4, fontSize: 12, color: "#2d8c5e",
          }}>
            <span>{msg.fileInfo.type.startsWith("image/") ? "🖼" : "📄"}</span>
            <span style={{ fontWeight: 600 }}>{msg.fileInfo.name}</span>
          </div>
        )}
        {displayText && (
          <div style={{
            background: isUser ? "#2d8c5e" : "#fff",
            color: isUser ? "#fff" : "#1a1a1a",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            padding: "11px 16px",
            fontSize: 14,
            lineHeight: 1.65,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: isUser ? "none" : "1px solid #e8ede9",
            whiteSpace: "pre-wrap",
          }}>{displayText}</div>
        )}
        {ext && <ExtraccionCard ext={ext} />}
        {doc && <DocumentCard doc={doc} onDownload={() => generatePDF(doc)} />}
        {doc && <PanelEnvio doc={doc} />}
      </div>
    </div>
  );
}

function UploadZone({ onFiles, disabled }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef(null);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (files.length) onFiles(files);
  }, [onFiles, disabled]);

  return (
    <div
      onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && ref.current?.click()}
      style={{
        border: `2px dashed ${dragging ? "#2d8c5e" : "#c8ddd3"}`,
        borderRadius: 10,
        padding: "10px 16px",
        textAlign: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        background: dragging ? "#e8f4ee" : "#f9faf9",
        transition: "all 0.2s",
        fontSize: 13,
        color: "#555",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        multiple
        style={{ display: "none" }}
        onChange={e => {
          const files = Array.from(e.target.files);
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
      📎 Adjunta orden médica, fórmula, autorización o respuesta de EPS (imagen o PDF)
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────

export default function EPSReclamaciones() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [analyzingDoc, setAnalyzingDoc] = useState(false);
  const [extractedData, setExtractedData] = useState([]);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, loading, analyzingDoc]);

  // ── AGENTE DOCUMENTAL: analiza archivos con Claude Vision ──
  async function analyzeDocuments(files) {
    setAnalyzingDoc(true);
    const results = [];

    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        const mediaType = getMediaType(file);
        const isPdf = mediaType === "application/pdf";

        const contentBlock = isPdf
          ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
          : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: AGENTE_DOCUMENTAL_PROMPT,
            messages: [{
              role: "user",
              content: [
                contentBlock,
                { type: "text", text: "Analiza este documento médico y extrae la información para el reclamo." }
              ]
            }]
          })
        });

        const data = await res.json();
        const responseText = data.content?.map(b => b.text || "").join("") || "";
        const ext = parseExtraccion(responseText);
        if (ext) {
          results.push({ file, ext, raw: responseText });
        } else {
          results.push({ file, ext: null, raw: responseText });
        }
      } catch (err) {
        results.push({ file, ext: null, raw: "Error al analizar el documento." });
      }
    }

    setAnalyzingDoc(false);
    return results;
  }

  // ── Enviar mensaje al orquestador principal ──
  async function sendMessage(userText, filesAttached = [], fileAnalysisResults = []) {
    if ((!userText.trim() && filesAttached.length === 0) || loading) return;

    // Construir contenido del mensaje del usuario para la API
    const userContent = [];

    // Adjuntar archivos analizados como contexto
    if (fileAnalysisResults.length > 0) {
      const contexto = fileAnalysisResults.map((r, i) => {
        const fmt = r.ext ? formatExtraccionParaChat(r.ext) : "No se pudo leer el documento.";
        return `[Documento ${i + 1}: ${r.file.name}]\n${fmt}`;
      }).join("\n\n");

      userContent.push({
        type: "text",
        text: `He subido ${fileAnalysisResults.length} documento(s). Aquí está la información extraída:\n\n${contexto}${userText.trim() ? "\n\nAdemás quiero decirte: " + userText.trim() : ""}`
      });
    } else if (userText.trim()) {
      userContent.push({ type: "text", text: userText.trim() });
    }

    // Mensaje visual en el chat
    const userMsg = {
      role: "user",
      content: fileAnalysisResults.length > 0
        ? (userText.trim() ? userText.trim() : `Subí ${fileAnalysisResults.length} documento(s) para analizar.`)
        : userText.trim(),
      fileInfo: filesAttached.length === 1 ? filesAttached[0] : null,
    };

    // Tarjetas de extracción como mensajes de la IA
    const extractionMsgs = fileAnalysisResults
      .filter(r => r.ext)
      .map(r => ({
        role: "assistant",
        content: `He analizado el documento **${r.file.name}**:\n\n${r.raw}`,
      }));

    const newMessages = [...messages, userMsg, ...extractionMsgs];
    setMessages(newMessages);
    setInput("");
    setPendingFiles([]);
    setLoading(true);
    setStreamingText("");

    // Historial para la API (solo text, sin binarios)
    const apiHistory = newMessages.map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

    // Reemplazar último mensaje del usuario con el contenido real
    if (fileAnalysisResults.length > 0 || userContent.length > 0) {
      apiHistory[messages.length] = {
        role: "user",
        content: userContent.length === 1 && userContent[0].type === "text"
          ? userContent[0].text
          : userContent,
      };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: apiHistory,
          stream: true,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "content_block_delta" && data.delta?.text) {
                full += data.delta.text;
                setStreamingText(full);
              }
            } catch {}
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: full }]);
      setStreamingText("");
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Lo siento, hubo un problema de conexión. Por favor intenta de nuevo.",
      }]);
      setStreamingText("");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  async function handleSend() {
    if (loading || analyzingDoc) return;
    if (!input.trim() && pendingFiles.length === 0) return;

    if (pendingFiles.length > 0) {
      const results = await analyzeDocuments(pendingFiles);
      setExtractedData(prev => [...prev, ...results.filter(r => r.ext).map(r => r.ext)]);
      await sendMessage(input, pendingFiles, results);
    } else {
      await sendMessage(input);
    }
  }

  function handleStart() {
    setStarted(true);
    sendMessage("Hola, quiero presentar una reclamación ante mi EPS.");
  }

  function downloadDocument(doc) {
    const lines = [
      doc.tipo, "=".repeat(50), "",
      doc.ciudadFecha, "",
      "Señores", doc.destinatario, "Ciudad", "",
      `ASUNTO: ${doc.asunto}`, "",
      `Yo, ${doc.solicitanteNombre}, identificado(a) con ${doc.solicitanteDoc},`,
      `con número de contacto / correo: ${doc.solicitanteContacto},`,
      "me permito elevar ante ustedes la siguiente reclamación, con fundamento en las normas vigentes:", "",
      "I. HECHOS", "=========", doc.hechos, "",
      "II. FUNDAMENTOS DE DERECHO", "==========================", doc.fundamentosDerecho || "", "",
      "III. SOLICITUDES", "================", doc.solicitudes, "",
      "IV. ADVERTENCIA LEGAL", "=====================", doc.advertenciaLegal || "", "",
      "V. DOCUMENTOS ANEXOS", "====================", doc.anexos, "",
      `Para notificaciones: ${doc.solicitanteContacto}`, "",
      "Atentamente,", "", doc.solicitanteNombre, doc.solicitanteDoc, "",
      "---", "Borrador generado con apoyo tecnológico. Revisar antes de radicar.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reclamo-eps-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const quickOptions = [
    "Cita médica demorada", "Medicamento no entregado",
    "Cirugía o procedimiento pendiente", "Autorización negada",
    "Examen diagnóstico pendiente", "Incapacidad con problemas",
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#f5f7f5" }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        .msg-in { animation: fadeIn 0.25s ease; }
        textarea:focus { outline: none; }
        button:active { transform: scale(0.97); }
        .quick-btn:hover { background: #e8f4ee !important; border-color: #2d8c5e !important; }
      `}</style>

      {/* Header */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e0e8e2",
        padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: "50%", background: "#2d8c5e",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, color: "#fff", fontWeight: 800,
        }}>+</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a1a" }}>Asistente de reclamaciones EPS</div>
          <div style={{ fontSize: 12, color: "#2d8c5e" }}>Colombia · Etapa 2 · Chat + Lectura de documentos</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {extractedData.length > 0 && (
            <span style={{
              fontSize: 11, background: "#e8f4ee", color: "#2d8c5e",
              borderRadius: 12, padding: "3px 10px", fontWeight: 600,
            }}>📄 {extractedData.length} doc{extractedData.length > 1 ? "s" : ""} analizados</span>
          )}
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setStarted(false); setExtractedData([]); setPendingFiles([]); }} style={{
              fontSize: 12, color: "#888", background: "none",
              border: "1px solid #ddd", borderRadius: 8, padding: "4px 10px", cursor: "pointer",
            }}>Nueva reclamación</button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
        {!started ? (
          <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 24 }}>
            <div style={{
              background: "#fff", borderRadius: 20, padding: "32px 28px",
              border: "1px solid #e0e8e2", textAlign: "center", marginBottom: 20,
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>
                Reclamaciones ante EPS
              </h2>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 20px" }}>
                Cuéntame tu problema o sube directamente tus documentos médicos.
                La IA los lee, extrae los datos y prepara tu reclamo automáticamente.
              </p>
              <div style={{
                background: "#f0f9f4", borderRadius: 10, padding: "10px 14px",
                marginBottom: 20, fontSize: 13, color: "#2d4a38", textAlign: "left",
              }}>
                <strong>Nuevo en Etapa 2:</strong> Sube fotos de órdenes médicas, fórmulas, autorizaciones o respuestas de tu EPS. La IA extrae todos los datos automáticamente.
              </div>
              <button onClick={handleStart} style={{
                background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 12,
                padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%",
              }}>Iniciar reclamación</button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 10, textAlign: "center" }}>O escoge tu problema directamente:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {quickOptions.map(opt => (
                  <button key={opt} className="quick-btn" onClick={() => { setStarted(true); sendMessage(opt); }} style={{
                    background: "#fff", border: "1px solid #dde8e0", borderRadius: 10,
                    padding: "10px 12px", fontSize: 13, color: "#2d4a38", cursor: "pointer",
                    textAlign: "left", lineHeight: 1.4, transition: "all 0.15s",
                  }}>{opt}</button>
                ))}
              </div>
            </div>
            <div style={{
              background: "#fff8e1", border: "1px solid #f9c74f", borderRadius: 10,
              padding: "10px 14px", fontSize: 12, color: "#7a6000", lineHeight: 1.5,
            }}>
              ⚠️ Este asistente no reemplaza asesoría jurídica ni atención médica. Si tienes una emergencia, llama al 123.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            {messages.map((msg, i) => (
              <div key={i} className="msg-in">
                <MessageBubble msg={msg} onDownload={downloadDocument} />
              </div>
            ))}

            {/* Indicador analizando documentos */}
            {analyzingDoc && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }} className="msg-in">
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "#4a6fa5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0,
                }}>📄</div>
                <div style={{
                  background: "#fff", borderRadius: "18px 18px 18px 4px",
                  border: "1px solid #c8d8f0", padding: "11px 16px", fontSize: 14, color: "#4a6fa5",
                }}>
                  Analizando documento con IA...
                </div>
              </div>
            )}

            {/* Streaming */}
            {loading && !analyzingDoc && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 16 }} className="msg-in">
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "#2d8c5e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "#fff", fontWeight: 700, flexShrink: 0,
                }}>IA</div>
                <div style={{
                  background: "#fff", borderRadius: "18px 18px 18px 4px",
                  border: "1px solid #e8ede9", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minWidth: 60,
                }}>
                  {streamingText
                    ? <div style={{ padding: "11px 16px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", maxWidth: 520 }}>{stripDocument(streamingText)}</div>
                    : <TypingDots />
                  }
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      {started && (
        <div style={{ background: "#fff", borderTop: "1px solid #e0e8e2", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ maxWidth: 680, margin: "0 auto" }}>

            {/* Archivos pendientes */}
            {pendingFiles.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {pendingFiles.map((f, i) => (
                  <FilePreview key={i} file={f} onRemove={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} />
                ))}
              </div>
            )}

            {/* Zona de subida */}
            <div style={{ marginBottom: 8 }}>
              <UploadZone
                disabled={loading || analyzingDoc}
                onFiles={files => setPendingFiles(prev => [...prev, ...files])}
              />
            </div>

            {/* Textarea + botón */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
                }}
                placeholder={pendingFiles.length > 0 ? "Añade un comentario (opcional)..." : "Escribe tu respuesta... (Enter para enviar)"}
                rows={1}
                style={{
                  flex: 1, border: "1.5px solid #dde8e0", borderRadius: 12,
                  padding: "10px 14px", fontSize: 14, resize: "none",
                  fontFamily: "system-ui", lineHeight: 1.5, background: "#f9faf9",
                  maxHeight: 120, overflowY: "auto",
                }}
                onInput={e => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && pendingFiles.length === 0) || loading || analyzingDoc}
                style={{
                  background: (input.trim() || pendingFiles.length > 0) && !loading && !analyzingDoc ? "#2d8c5e" : "#c8ddd3",
                  color: "#fff", border: "none", borderRadius: 12,
                  width: 44, height: 44, fontSize: 18,
                  cursor: (input.trim() || pendingFiles.length > 0) && !loading && !analyzingDoc ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 0.2s", flexShrink: 0,
                }}
              >{analyzingDoc ? "⏳" : "↑"}</button>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 6 }}>
              Shift+Enter para salto de línea · Documentos aceptados: imagen o PDF
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
