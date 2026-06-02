import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "jspdf";

// ─────────────────────────────────────────────
// CONFIGURACIÓN SUPABASE
// Reemplaza con tus credenciales de supabase.com
// ─────────────────────────────────────────────
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// SQL PARA CREAR LAS TABLAS EN SUPABASE
// Ejecuta esto en el SQL Editor de Supabase:
//
// create table reclamos (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade,
//   eps text,
//   tipo_problema text,
//   tipo_documento text,
//   nivel_urgencia text,
//   estado text default 'en_proceso',
//   fecha_creacion timestamptz default now(),
//   fecha_respuesta_esperada timestamptz,
//   mensajes jsonb default '[]',
//   documento_generado jsonb,
//   datos_extraidos jsonb default '[]',
//   notas text
// );
// alter table reclamos enable row level security;
// create policy "Users can manage own reclamos"
//   on reclamos for all using (auth.uid() = user_id);
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// PROMPTS IA
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente inteligente de una plataforma de reclamaciones ante EPS en Colombia. Orquestas 6 agentes internos para ayudar al usuario a preparar su reclamo con pleno rigor jurídico. Actúas con tono humano, empático, claro y profesional.

FLUJO OBLIGATORIO:
1. RECEPCIÓN: Saluda y recolecta información con estas preguntas (una a la vez, de forma conversacional):
   - ¿Cuál es tu EPS?
   - ¿Qué problema tienes? (cita médica / medicamentos / cirugía / examen / autorización / incapacidad / mala atención / otro)
   - ¿Desde cuándo esperas solución?
   - ¿Qué respuesta ha dado la EPS?
   - ¿Tienes documentos? (orden médica, fórmula, radicado, respuesta escrita)
   - ¿Qué quieres que la EPS haga concretamente?

2. RIESGO: Evalúa urgencia. Si es CRÍTICO di primero: "⚠️ Busca atención en urgencias ahora." Luego continúa.
   - CRÍTICO: síntomas graves, riesgo vital, ideación suicida
   - ALTO: menor de edad, adulto mayor, embarazo, discapacidad, tratamiento interrumpido
   - MEDIO: demora prolongada, falta de respuesta
   - BAJO: trámite administrativo sin riesgo

3. CLASIFICACIÓN: Determina el tipo de documento:
   - PQRS: casos simples, primeras reclamaciones
   - DERECHO DE PETICIÓN: demoras superiores a 3 días hábiles, sin respuesta, o negativa de servicios del PBS
   - SOLICITUD PRIORITARIA: urgencia ALTA, pacientes vulnerables (menores, adultos mayores, embarazadas, personas con discapacidad)
   - TUTELA PRELIMINAR (borrador): urgencia crítica, derechos fundamentales vulnerados, salud como derecho fundamental (Ley 1751/2015)

4. MARCO JURÍDICO — aplica las normas correspondientes según el caso concreto:

   PQRS / Servicio general:
   - Artículo 49 Constitución Política de Colombia (derecho a la salud y a la seguridad social)
   - Ley 100 de 1993 (Sistema General de Seguridad Social en Salud — obligaciones de las EPS)
   - Ley 1438 de 2011 (reforma al SGSSS — derechos y deberes del afiliado, Art. 10)
   - Resolución 1552 de 2013 Ministerio de Salud (tiempos máximos de espera para citas)
   - Circular 047 de 2007 Supersalud (obligaciones de atención y servicio al usuario)

   DERECHO DE PETICIÓN:
   - Artículo 23 Constitución Política de Colombia (derecho fundamental de petición)
   - Ley 1755 de 2015, Arts. 13 al 33 CPACA (derecho de petición ante entidades que prestan servicios públicos)
   - Art. 14 Ley 1755/2015: la EPS debe dar respuesta de fondo en 15 días hábiles
   - Art. 49 Constitución Política de Colombia
   - Ley 100 de 1993, Art. 153 (principios del SGSSS: calidad, oportunidad, eficiencia)

   MEDICAMENTOS / TECNOLOGÍAS EN SALUD:
   - Resolución 5592 de 2015 y sus modificaciones (Plan de Beneficios en Salud — PBS)
   - Ley 1751 de 2015, Art. 10 lit. f (garantías: oportunidad, continuidad, integralidad)
   - Ley 1751 de 2015, Art. 15 (prohibición de negar, suspender o interrumpir servicios del PBS)
   - Sentencia T-760 de 2008 Corte Constitucional (salud como derecho fundamental; obligaciones de las EPS)
   - Sentencia SU-819 de 1999 Corte Constitucional (principio de continuidad del tratamiento médico)

   TUTELA:
   - Artículo 86 Constitución Política de Colombia (acción de tutela)
   - Decreto 2591 de 1991 (reglamentación de la tutela — fallo en 10 días)
   - Ley 1751 de 2015 (Ley Estatutaria de Salud — salud como derecho fundamental)
   - Sentencia T-760 de 2008 Corte Constitucional
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
   - Art. 44 Constitución Política (derechos fundamentales de los niños — prevalencia)
   - Art. 46 Constitución Política (protección especial al adulto mayor)
   - Art. 43 Constitución Política (protección de la mujer embarazada)
   - Ley 1751 de 2015, Art. 6 (atención prioritaria a sujetos de especial protección constitucional)

5. REDACCIÓN: Usa este formato exacto:

---DOCUMENTO_INICIO---
TIPO: [PQRS / DERECHO DE PETICIÓN / SOLICITUD PRIORITARIA / TUTELA PRELIMINAR]
CIUDAD_FECHA: [ciudad], [fecha]
DESTINATARIO: [EPS — Defensoría del Usuario / Gerencia / dependencia correspondiente]
ASUNTO: [asunto claro y concreto]
SOLICITANTE_NOMBRE: [nombre completo]
SOLICITANTE_DOC: [tipo y número de documento]
SOLICITANTE_CONTACTO: [teléfono / correo / dirección para notificaciones]
HECHOS:
[hechos numerados en orden cronológico con fechas precisas]
FUNDAMENTOS_DE_DERECHO:
[normas aplicables: artículo, ley y su relevancia concreta para este caso]
SOLICITUDES:
[solicitudes numeradas, concretas y con plazo explícito]
ADVERTENCIA_LEGAL:
[consecuencias del incumplimiento: sanciones Supersalud, tutela, denuncia ante el Ministerio de Salud]
ANEXOS:
[documentos que se adjuntan o deben adjuntarse para sustentar el reclamo]
SIGUIENTE_PASO: [acción concreta si no hay respuesta oportuna]
---DOCUMENTO_FIN---

6. SEGUIMIENTO: Informa plazos legales y próximos pasos:
   - PQRS / Derecho de Petición: 15 días hábiles (Art. 14 Ley 1755/2015)
   - Solicitud Prioritaria: 10 días hábiles
   - Tutela: fallo en 10 días calendario (Art. 29 Decreto 2591/1991)
   - Canal de radicación: presencial, correo certificado, plataforma EPS, Supersalud (www.supersalud.gov.co — 018000-513700)

REGLAS: Nunca inventes datos. Usa [DATO PENDIENTE]. Cita SIEMPRE al menos 3 normas jurídicas vigentes. No asesoría jurídica definitiva. Lenguaje jurídico colombiano formal: "me permito elevar ante usted", "con fundamento en las normas vigentes", "respetuosamente solicito".`;

const AGENTE_DOCUMENTAL_PROMPT = `Eres el Agente Documental de una plataforma de reclamaciones ante EPS en Colombia.
Analiza el documento y devuelve ÚNICAMENTE este bloque, sin texto adicional:

---EXTRACCION_INICIO---
{
  "tipo_documento": "...",
  "fecha_documento": "...",
  "nombre_paciente": "...",
  "tipo_doc_paciente": "...",
  "numero_doc_paciente": "...",
  "eps": "...",
  "ips_medico": "...",
  "ciudad": "...",
  "servicio_solicitado": "...",
  "diagnostico": "...",
  "numero_radicado": "...",
  "respuesta_eps": "...",
  "fecha_respuesta_eps": "...",
  "observaciones": "...",
  "datos_faltantes": "...",
  "resumen_para_reclamo": "..."
}
---EXTRACCION_FIN---

Reglas: Si no aparece un dato escribe "No identificado". No inventes información.`;

// ─────────────────────────────────────────────
// BASE DE DATOS EPS Y ORGANISMOS COLOMBIA
// ─────────────────────────────────────────────
const EPS_DATABASE = {
  "Sura": { email: "pqrs@sura.com", portal: "https://www.sura.com/salud", telefono: "018000-052-052", pqrsPortal: "https://www.sura.com/salud" },
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
const SUPERSALUD = { nombre: "Superintendencia Nacional de Salud", email: "supersalud@supersalud.gov.co", portal: "https://www.supersalud.gov.co", pqrdPortal: "https://www.supersalud.gov.co/es-co/supersalud/radique-su-pqrd", telefono: "018000-513-700" };
const DEFENSORIA = { nombre: "Defensoría del Pueblo", portal: "https://www.defensoria.gov.co", telefono: "018000-914-814" };

function detectarEPS(destinatario) {
  if (!destinatario) return null;
  const d = destinatario.toLowerCase();
  return Object.keys(EPS_DATABASE).find(k => d.includes(k.toLowerCase())) || null;
}

function generatePDF(doc) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin = 22, pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight(), contentW = pageW - margin * 2;
  let y = margin;
  const checkPage = (n = 10) => { if (y + n > pageH - margin) { pdf.addPage(); y = margin; } };
  const addLine = (text, size = 10, bold = false, color = [30, 30, 30], indent = 0) => {
    pdf.setFontSize(size); pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text || "", contentW - indent);
    checkPage(lines.length * size * 0.42 + 2);
    pdf.text(lines, margin + indent, y); y += lines.length * size * 0.42 + 1;
  };
  const addSection = (title, content, color = [45, 140, 94]) => {
    if (!content?.trim()) return; y += 4; checkPage(14);
    pdf.setFillColor(...color); pdf.roundedRect(margin, y - 4, contentW, 7, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10); pdf.setTextColor(255, 255, 255);
    pdf.text(title, margin + 3, y); y += 6; addLine(content, 10, false, [40, 40, 40]);
  };
  pdf.setFillColor(45, 140, 94); pdf.rect(0, 0, pageW, 22, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(255, 255, 255);
  pdf.text(doc.tipo || "DOCUMENTO EPS", margin, 10);
  pdf.setFontSize(9); pdf.setFont("helvetica", "normal"); pdf.text("Plataforma de Reclamaciones EPS Colombia", margin, 16);
  y = 28;
  addLine(doc.ciudadFecha || "", 10, false, [100, 100, 100]); y += 3;
  addLine("Señores", 10, true); addLine(doc.destinatario || "", 10); addLine("Ciudad", 10); y += 3;
  addLine(`ASUNTO: ${doc.asunto || ""}`, 11, true, [30, 30, 30]); y += 3;
  addLine(`Yo, ${doc.solicitanteNombre || "[NOMBRE]"}, identificado(a) con ${doc.solicitanteDoc || "[DOC]"}, con contacto ${doc.solicitanteContacto || "[CONTACTO]"}, me permito elevar ante ustedes la siguiente reclamación con fundamento en las normas vigentes:`, 10, false, [50, 50, 50]);
  addSection("I.  HECHOS", doc.hechos, [45, 140, 94]);
  addSection("II.  FUNDAMENTOS DE DERECHO", doc.fundamentosDerecho, [74, 63, 140]);
  addSection("III.  SOLICITUDES", doc.solicitudes, [45, 140, 94]);
  addSection("IV.  ADVERTENCIA LEGAL", doc.advertenciaLegal, [180, 100, 0]);
  addSection("V.  DOCUMENTOS ANEXOS", doc.anexos, [45, 140, 94]);
  if (doc.siguientePaso) { y += 3; addLine("Siguiente paso:", 10, true, [180, 100, 0]); addLine(doc.siguientePaso, 10, false, [100, 70, 0]); }
  y += 10; checkPage(30); addLine("Atentamente,", 10); y += 8;
  addLine(doc.solicitanteNombre || "[NOMBRE]", 11, true); addLine(doc.solicitanteDoc || "", 10);
  const totalPages = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i); pdf.setFontSize(7); pdf.setTextColor(160, 160, 160);
    pdf.text("Borrador generado con apoyo tecnológico. Revisar antes de radicar.", margin, pageH - 8);
    pdf.text(`Pág. ${i}/${totalPages}`, pageW - margin - 12, pageH - 8);
  }
  pdf.save(`reclamo-eps-${Date.now()}.pdf`);
}

function handleEnviarEPS(doc) {
  generatePDF(doc);
  const epsKey = detectarEPS(doc.destinatario);
  const epsInfo = epsKey ? EPS_DATABASE[epsKey] : null;
  const to = epsInfo?.email || "";
  const subject = encodeURIComponent(`${doc.tipo || "PQRS"} - ${doc.solicitanteNombre || ""} - ${doc.solicitanteDoc || ""}`);
  const body = encodeURIComponent(`Señores ${doc.destinatario || "EPS"},\n\nASUNTO: ${doc.asunto || ""}\n\n${doc.solicitanteNombre || ""}, ${doc.solicitanteDoc || ""}, ${doc.solicitanteContacto || ""}\n\nAdjunto el documento PDF con hechos y fundamentos de derecho completos.\n\nSolicito respuesta en los plazos legales.\n\nAtentamente,\n${doc.solicitanteNombre || ""}`);
  setTimeout(() => { window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self"); }, 600);
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function parseDocument(text) {
  const s = text?.indexOf("---DOCUMENTO_INICIO---");
  const e = text?.indexOf("---DOCUMENTO_FIN---");
  if (!text || s === -1 || e === -1) return null;
  const raw = text.slice(s + 22, e).trim();
  const get = (key) => {
    const m = raw.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]+:|$)`, "s"));
    return m ? m[1].trim() : "";
  };
  return {
    tipo: get("TIPO"), ciudadFecha: get("CIUDAD_FECHA"), destinatario: get("DESTINATARIO"),
    asunto: get("ASUNTO"), solicitanteNombre: get("SOLICITANTE_NOMBRE"),
    solicitanteDoc: get("SOLICITANTE_DOC"), solicitanteContacto: get("SOLICITANTE_CONTACTO"),
    hechos: get("HECHOS"), fundamentosDerecho: get("FUNDAMENTOS_DE_DERECHO"),
    solicitudes: get("SOLICITUDES"), advertenciaLegal: get("ADVERTENCIA_LEGAL"),
    anexos: get("ANEXOS"), siguientePaso: get("SIGUIENTE_PASO"),
  };
}

function parseExtraccion(text) {
  if (!text) return null;
  const s = text.indexOf("---EXTRACCION_INICIO---");
  const e = text.indexOf("---EXTRACCION_FIN---");
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(text.slice(s + 23, e).trim()); } catch { return null; }
}

function stripBlocks(text) {
  if (!text) return "";
  let t = text;
  const ds = t.indexOf("---DOCUMENTO_INICIO---"); const de = t.indexOf("---DOCUMENTO_FIN---");
  if (ds !== -1 && de !== -1) t = (t.slice(0, ds) + t.slice(de + 19)).trim();
  const es = t.indexOf("---EXTRACCION_INICIO---"); const ee = t.indexOf("---EXTRACCION_FIN---");
  if (es !== -1 && ee !== -1) t = (t.slice(0, es) + t.slice(ee + 20)).trim();
  return t;
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function formatExtraccionParaChat(ext) {
  if (!ext) return "";
  return [
    ["Tipo", ext.tipo_documento], ["Fecha", ext.fecha_documento],
    ["Paciente", ext.nombre_paciente], ["EPS", ext.eps],
    ["IPS/Médico", ext.ips_medico], ["Servicio", ext.servicio_solicitado],
    ["Radicado", ext.numero_radicado],
  ].filter(([,v]) => v && v !== "No identificado")
   .map(([k,v]) => `${k}: ${v}`).join("\n")
   + (ext.resumen_para_reclamo ? `\n\n${ext.resumen_para_reclamo}` : "");
}

function calcFechaRespuesta(tipo) {
  const dias = { "PQRS": 15, "DERECHO DE PETICIÓN": 15, "SOLICITUD PRIORITARIA": 10 };
  const d = dias[tipo] || 15;
  const f = new Date(); f.setDate(f.getDate() + d);
  return f.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

const ESTADO_COLORS = {
  en_proceso: { bg: "#fff8e1", color: "#b8860b", label: "En proceso" },
  respondido: { bg: "#e8f4ee", color: "#2d8c5e", label: "Respondido" },
  cerrado: { bg: "#f0f0f0", color: "#666", label: "Cerrado" },
  escalado: { bg: "#fce8e8", color: "#c0392b", label: "Escalado" },
};

// ─────────────────────────────────────────────
// COMPONENTES UI
// ─────────────────────────────────────────────
function Badge({ estado }) {
  const c = ESTADO_COLORS[estado] || ESTADO_COLORS.en_proceso;
  return (
    <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>
      {c.label}
    </span>
  );
}

function ExtraccionCard({ ext }) {
  const fields = [
    ["Tipo", ext.tipo_documento], ["Fecha", ext.fecha_documento],
    ["Paciente", ext.nombre_paciente],
    ["Documento", ext.numero_doc_paciente !== "No identificado" ? `${ext.tipo_doc_paciente} ${ext.numero_doc_paciente}` : null],
    ["EPS", ext.eps], ["IPS / Médico", ext.ips_medico], ["Ciudad", ext.ciudad],
    ["Servicio", ext.servicio_solicitado], ["Radicado", ext.numero_radicado],
  ].filter(([,v]) => v && v !== "No identificado");
  return (
    <div style={{ background: "linear-gradient(135deg,#f0f4ff,#e8f4fd)", border: "1.5px solid #4a6fa5", borderRadius: 14, padding: "14px 18px", marginTop: 10, fontSize: 13 }}>
      <span style={{ background: "#4a6fa5", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: 1 }}>DOCUMENTO ANALIZADO</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 14px", marginTop: 10 }}>
        {fields.map(([k,v]) => <div key={k}><span style={{ color: "#4a6fa5", fontWeight: 700 }}>{k}:</span> {v}</div>)}
      </div>
      {ext.resumen_para_reclamo && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", borderLeft: "3px solid #4a6fa5", marginTop: 8, color: "#333", lineHeight: 1.5 }}>
          {ext.resumen_para_reclamo}
        </div>
      )}
      {ext.datos_faltantes && ext.datos_faltantes !== "No identificado" && (
        <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", marginTop: 6, color: "#7a6000", fontSize: 12 }}>
          ⚠️ <strong>Faltantes:</strong> {ext.datos_faltantes}
        </div>
      )}
    </div>
  );
}

function PanelEnvio({ doc }) {
  const epsKey = detectarEPS(doc.destinatario);
  const epsInfo = epsKey ? EPS_DATABASE[epsKey] : null;
  const [copiado, setCopiado] = useState(false);
  const copiarEmail = (email) => { navigator.clipboard.writeText(email).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 2000); }); };
  return (
    <div style={{ background: "#f0faf4", border: "1.5px solid #2d8c5e", borderRadius: 14, padding: "16px 18px", marginTop: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: "#2d8c5e", marginBottom: 12 }}>📤 Enviar documento</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => handleEnviarEPS(doc)} style={{ background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: 1 }}>
          📧 Enviar al EPS (descarga PDF + abre email)
        </button>
        <button onClick={() => generatePDF(doc)} style={{ background: "#fff", color: "#2d8c5e", border: "1.5px solid #2d8c5e", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          ⬇ Solo PDF
        </button>
      </div>
      {epsInfo ? (
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>📋 Contacto directo — {epsKey}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#888", width: 60 }}>📧 Email</span>
            <a href={`mailto:${epsInfo.email}`} style={{ color: "#2d8c5e", fontWeight: 600 }}>{epsInfo.email}</a>
            <button onClick={() => copiarEmail(epsInfo.email)} style={{ background: "none", border: "1px solid #dde8e0", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#888" }}>{copiado ? "✓" : "Copiar"}</button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ color: "#888", width: 60 }}>📞 Tel</span>
            <span style={{ color: "#333" }}>{epsInfo.telefono}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#888", width: 60 }}>🌐 Portal</span>
            <a href={epsInfo.pqrsPortal} target="_blank" rel="noreferrer" style={{ color: "#2d8c5e" }}>Radicar en portal EPS →</a>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#7a6000" }}>
          ⚠️ Busca el correo de PQRS de tu EPS en su página oficial para enviarlo.
        </div>
      )}
      <div style={{ borderTop: "1px solid #c8e6d4", paddingTop: 10, marginTop: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>ESCALAMIENTO (si la EPS no responde)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={SUPERSALUD.pqrdPortal} target="_blank" rel="noreferrer" style={{ background: "#4a6fa5", color: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", flex: 1, textAlign: "center" }}>🏛 Supersalud (PQRD online)</a>
          <a href={`tel:${SUPERSALUD.telefono}`} style={{ background: "#fff", color: "#4a6fa5", border: "1.5px solid #4a6fa5", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>📞 {SUPERSALUD.telefono}</a>
        </div>
        <a href={DEFENSORIA.portal} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, background: "#fce8e8", color: "#c0392b", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
          ⚖️ Defensoría del Pueblo — Tutela gratuita
        </a>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
        "Enviar al EPS" descarga el PDF y abre tu correo con destinatario y asunto pre-llenados. Solo adjunta el PDF y envía.
      </div>
    </div>
  );
}

function DocumentCard({ doc, onDownload }) {
  return (
    <div style={{ background: "linear-gradient(135deg,#f0f9f4,#e8f4fd)", border: "1.5px solid #2d8c5e", borderRadius: 16, padding: "18px 22px", marginTop: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <span style={{ background: "#2d8c5e", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: 1 }}>{doc.tipo}</span>
          <div style={{ fontSize: 13, color: "#555", marginTop: 5 }}>{doc.ciudadFecha}</div>
        </div>
        <button onClick={() => generatePDF(doc)} style={{ background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>⬇ PDF</button>
      </div>
      <div style={{ fontSize: 14, color: "#1a1a1a", lineHeight: 1.7 }}>
        <div style={{ marginBottom: 6 }}><strong>Para:</strong> {doc.destinatario}</div>
        <div style={{ marginBottom: 10 }}><strong>Asunto:</strong> {doc.asunto}</div>
        <hr style={{ border: "none", borderTop: "1px solid #c8e6d4", margin: "10px 0" }} />
        <div style={{ marginBottom: 6 }}><strong>Solicitante:</strong> {doc.solicitanteNombre} — {doc.solicitanteDoc}</div>
        {doc.hechos && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: "#2d8c5e", marginBottom: 3 }}>Hechos</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{doc.hechos}</div>
          </div>
        )}
        {doc.fundamentosDerecho && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: "#4a3f8c", marginBottom: 6 }}>⚖️ Fundamentos de Derecho</div>
            <div style={{ background: "#f0f0ff", border: "1px solid #c0b8e8", borderRadius: 8, padding: "10px 14px", whiteSpace: "pre-wrap", color: "#2a2060", fontSize: 13, lineHeight: 1.65 }}>{doc.fundamentosDerecho}</div>
          </div>
        )}
        {doc.solicitudes && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: "#2d8c5e", marginBottom: 3 }}>Solicitudes</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{doc.solicitudes}</div>
          </div>
        )}
        {doc.advertenciaLegal && (
          <div style={{ background: "#fff3cd", border: "1px solid #f0ad4e", borderRadius: 8, padding: "10px 14px", marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: "#856404", marginBottom: 3 }}>⚠️ Advertencia Legal</div>
            <div style={{ color: "#533f03", fontSize: 13, lineHeight: 1.6 }}>{doc.advertenciaLegal}</div>
          </div>
        )}
        {doc.anexos && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: "#2d8c5e", marginBottom: 3 }}>Anexos</div>
            <div style={{ whiteSpace: "pre-wrap", color: "#333" }}>{doc.anexos}</div>
          </div>
        )}
        {doc.siguientePaso && (
          <div style={{ background: "#fff8e1", border: "1px solid #f9c74f", borderRadius: 8, padding: "10px 14px", marginTop: 10 }}>
            <div style={{ fontWeight: 700, color: "#b8860b", marginBottom: 3 }}>📋 Siguiente paso</div>
            <div style={{ color: "#555", fontSize: 13 }}>{doc.siguientePaso}</div>
          </div>
        )}
        <div style={{ marginTop: 14, fontSize: 11, color: "#888", fontStyle: "italic", borderTop: "1px solid #c8e6d4", paddingTop: 8 }}>
          Borrador generado con apoyo tecnológico. Revisar antes de radicar.
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, onDownload }) {
  const isUser = msg.role === "user";
  const doc = !isUser ? parseDocument(msg.content) : null;
  const ext = !isUser ? parseExtraccion(msg.content) : null;
  const displayText = stripBlocks(msg.content);
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, alignItems: "flex-end", gap: 8 }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>IA</div>
      )}
      <div style={{ maxWidth: "78%" }}>
        {isUser && msg.fileInfo && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 5, marginBottom: 3, fontSize: 12, color: "#2d8c5e" }}>
            <span>{msg.fileInfo.type?.startsWith("image/") ? "🖼" : "📄"}</span>
            <span style={{ fontWeight: 600 }}>{msg.fileInfo.name}</span>
          </div>
        )}
        {displayText && (
          <div style={{ background: isUser ? "#2d8c5e" : "#fff", color: isUser ? "#fff" : "#1a1a1a", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 15px", fontSize: 14, lineHeight: 1.65, boxShadow: "0 1px 3px rgba(0,0,0,0.07)", border: isUser ? "none" : "1px solid #e8ede9", whiteSpace: "pre-wrap" }}>{displayText}</div>
        )}
        {ext && <ExtraccionCard ext={ext} />}
        {doc && <DocumentCard doc={doc} onDownload={() => generatePDF(doc)} />}
        {doc && <PanelEnvio doc={doc} />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px" }}>
      {[0,1,2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#2d8c5e", animation: "bounce 1.2s ease-in-out infinite", animationDelay: `${i*0.2}s` }} />)}
    </div>
  );
}

// ─────────────────────────────────────────────
// PANEL DE HISTORIAL
// ─────────────────────────────────────────────
function HistorialPanel({ userId, onOpen, onNew }) {
  const [reclamos, setReclamos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReclamos();
  }, [userId]);

  async function loadReclamos() {
    setLoading(true);
    const { data } = await supabase
      .from("reclamos")
      .select("*")
      .eq("user_id", userId)
      .order("fecha_creacion", { ascending: false });
    setReclamos(data || []);
    setLoading(false);
  }

  async function deleteReclamo(id) {
    if (!confirm("¿Eliminar este reclamo?")) return;
    await supabase.from("reclamos").delete().eq("id", id);
    setReclamos(prev => prev.filter(r => r.id !== id));
  }

  const stats = {
    total: reclamos.length,
    en_proceso: reclamos.filter(r => r.estado === "en_proceso").length,
    respondido: reclamos.filter(r => r.estado === "respondido").length,
  };

  if (loading) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888" }}>
      Cargando historial...
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            ["Total", stats.total, "#2d8c5e"],
            ["En proceso", stats.en_proceso, "#b8860b"],
            ["Respondidos", stats.respondido, "#4a6fa5"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "14px 16px", border: "1px solid #e0e8e2", textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Botón nuevo */}
        <button onClick={onNew} style={{
          width: "100%", background: "#2d8c5e", color: "#fff", border: "none",
          borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700,
          cursor: "pointer", marginBottom: 16,
        }}>+ Nueva reclamación</button>

        {/* Lista */}
        {reclamos.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: "40px 0", fontSize: 14 }}>
            No tienes reclamaciones aún.<br />
            <span style={{ color: "#2d8c5e", cursor: "pointer" }} onClick={onNew}>Crear la primera</span>
          </div>
        ) : (
          reclamos.map(r => (
            <div key={r.id} style={{
              background: "#fff", borderRadius: 14, border: "1px solid #e0e8e2",
              padding: "16px 18px", marginBottom: 10,
              cursor: "pointer", transition: "box-shadow 0.2s",
            }}
              onClick={() => onOpen(r)}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>
                    {r.eps || "EPS no definida"} — {r.tipo_problema || "Problema no definido"}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    {new Date(r.fecha_creacion).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                    {r.tipo_documento && ` · ${r.tipo_documento}`}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge estado={r.estado} />
                  <button onClick={e => { e.stopPropagation(); deleteReclamo(r.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: 16, padding: 2 }}>🗑</button>
                </div>
              </div>
              {r.nivel_urgencia && (
                <div style={{ fontSize: 12, color: r.nivel_urgencia === "ALTO" || r.nivel_urgencia === "CRÍTICO" ? "#c0392b" : "#888" }}>
                  Urgencia: {r.nivel_urgencia}
                </div>
              )}
              {r.fecha_respuesta_esperada && (
                <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                  Respuesta esperada: {new Date(r.fecha_respuesta_esperada).toLocaleDateString("es-CO")}
                </div>
              )}
              {Array.isArray(r.mensajes) && r.mensajes.length > 0 && (
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                  {r.mensajes.length} mensaje{r.mensajes.length !== 1 ? "s" : ""} · Haz clic para continuar
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PANTALLA AUTH
// ─────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit() {
    setError(""); setSuccess(""); setLoading(true);
    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onAuth(data.user);
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Revisa tu correo para confirmar tu cuenta.");
      }
    } catch (e) {
      setError(e.message || "Error al procesar la solicitud.");
    } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7f5", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "36px 32px", width: "100%", maxWidth: 400, border: "1px solid #e0e8e2" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🏥</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a1a" }}>Reclamaciones EPS</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Colombia · Plataforma con IA</div>
        </div>

        <div style={{ display: "flex", background: "#f5f7f5", borderRadius: 10, padding: 4, marginBottom: 22 }}>
          {["login","register"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              flex: 1, padding: "8px 0", border: "none", borderRadius: 8, cursor: "pointer",
              background: mode === m ? "#fff" : "transparent",
              fontWeight: mode === m ? 700 : 400, fontSize: 14, color: "#1a1a1a",
              boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s",
            }}>{m === "login" ? "Iniciar sesión" : "Crear cuenta"}</button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)}
            style={{ border: "1.5px solid #dde8e0", borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none" }} />
          <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            style={{ border: "1.5px solid #dde8e0", borderRadius: 10, padding: "11px 14px", fontSize: 14, outline: "none" }} />

          {error && <div style={{ background: "#fce8e8", border: "1px solid #f5c6c6", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#c0392b" }}>{error}</div>}
          {success && <div style={{ background: "#e8f4ee", border: "1px solid #c8e6d4", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#2d8c5e" }}>{success}</div>}

          <button onClick={handleSubmit} disabled={loading || !email || !password} style={{
            background: email && password && !loading ? "#2d8c5e" : "#c8ddd3",
            color: "#fff", border: "none", borderRadius: 10, padding: "12px",
            fontSize: 15, fontWeight: 700, cursor: email && password && !loading ? "pointer" : "default",
          }}>{loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}</button>
        </div>

        <div style={{ marginTop: 20, fontSize: 11, color: "#aaa", textAlign: "center", lineHeight: 1.5 }}>
          Tu información está protegida. No compartimos datos con terceros.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────
export default function EPSReclamaciones() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [view, setView] = useState("historial"); // historial | chat
  const [activeReclamo, setActiveReclamo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [analyzingDoc, setAnalyzingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, loading]);

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setView("historial"); setActiveReclamo(null); setMessages([]);
  }

  // Guardar / actualizar reclamo en Supabase
  async function saveReclamo(msgs, docGenerado = null, eps = null, tipoProblema = null, nivelUrgencia = null, tipoDoc = null) {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        mensajes: msgs,
        eps: eps || activeReclamo?.eps,
        tipo_problema: tipoProblema || activeReclamo?.tipo_problema,
        nivel_urgencia: nivelUrgencia || activeReclamo?.nivel_urgencia,
        tipo_documento: tipoDoc || activeReclamo?.tipo_documento,
        documento_generado: docGenerado || activeReclamo?.documento_generado,
        fecha_respuesta_esperada: docGenerado
          ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString()
          : activeReclamo?.fecha_respuesta_esperada,
      };

      if (activeReclamo?.id) {
        await supabase.from("reclamos").update(payload).eq("id", activeReclamo.id);
        setActiveReclamo(prev => ({ ...prev, ...payload }));
      } else {
        const { data } = await supabase.from("reclamos").insert([payload]).select().single();
        if (data) setActiveReclamo(data);
      }
    } finally { setSaving(false); }
  }

  // Agente documental
  async function analyzeDocuments(files) {
    setAnalyzingDoc(true);
    const results = [];
    for (const file of files) {
      try {
        const base64 = await fileToBase64(file);
        const mediaType = file.type === "application/pdf" ? "application/pdf" : (file.type || "image/jpeg");
        const isPdf = mediaType === "application/pdf";
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: AGENTE_DOCUMENTAL_PROMPT,
            messages: [{ role: "user", content: [
              isPdf
                ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
                : { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: "Analiza este documento médico y extrae la información para el reclamo." }
            ]}]
          })
        });
        const data = await res.json();
        const raw = data.content?.map(b => b.text || "").join("") || "";
        results.push({ file, ext: parseExtraccion(raw), raw });
      } catch { results.push({ file, ext: null, raw: "Error al analizar." }); }
    }
    setAnalyzingDoc(false);
    return results;
  }

  async function sendMessage(userText, filesAttached = [], fileResults = []) {
    if ((!userText.trim() && filesAttached.length === 0) || loading) return;

    const userContent = [];
    if (fileResults.length > 0) {
      const ctx = fileResults.map((r, i) => `[Doc ${i+1}: ${r.file.name}]\n${r.ext ? formatExtraccionParaChat(r.ext) : "No legible"}`).join("\n\n");
      userContent.push({ type: "text", text: `He subido ${fileResults.length} documento(s):\n\n${ctx}${userText.trim() ? "\n\nAdemás: " + userText.trim() : ""}` });
    } else if (userText.trim()) {
      userContent.push({ type: "text", text: userText.trim() });
    }

    const userMsg = {
      role: "user",
      content: fileResults.length > 0 ? (userText.trim() || `Subí ${fileResults.length} documento(s).`) : userText.trim(),
      fileInfo: filesAttached.length === 1 ? { name: filesAttached[0].name, type: filesAttached[0].type } : null,
    };

    const extractionMsgs = fileResults.filter(r => r.ext).map(r => ({
      role: "assistant",
      content: `He analizado el documento **${r.file.name}**:\n\n${r.raw}`,
    }));

    const newMessages = [...messages, userMsg, ...extractionMsgs];
    setMessages(newMessages);
    setInput(""); setPendingFiles([]);
    setLoading(true); setStreamingText("");

    const apiHistory = newMessages.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }));
    if (fileResults.length > 0 || userContent.length > 0) {
      apiHistory[messages.length] = {
        role: "user",
        content: userContent.length === 1 && userContent[0].type === "text" ? userContent[0].text : userContent,
      };
    }

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2000, system: SYSTEM_PROMPT, messages: apiHistory, stream: true }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const d = JSON.parse(line.slice(6));
              if (d.type === "content_block_delta" && d.delta?.text) { full += d.delta.text; setStreamingText(full); }
            } catch {}
          }
        }
      }

      const finalMsgs = [...newMessages, { role: "assistant", content: full }];
      setMessages(finalMsgs);
      setStreamingText("");

      // Detectar documento generado y guardar
      const doc = parseDocument(full);
      const epsDetected = apiHistory.find(m => typeof m.content === "string" && m.content.toLowerCase().includes("eps"))?.content?.match(/([A-ZÁÉÍÓÚ][a-záéíóú]+ EPS|Nueva EPS|Sura|Sanitas|Compensar|Coosalud|Cajacopi|Medimás|Coomeva|Famisanar|SOS|Aliansalud)/)?.[0];

      await saveReclamo(
        finalMsgs.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : "" })),
        doc || undefined,
        epsDetected || undefined,
        undefined,
        undefined,
        doc?.tipo || undefined
      );
    } catch {
      const errMsgs = [...newMessages, { role: "assistant", content: "Lo siento, hubo un problema de conexión. Intenta de nuevo." }];
      setMessages(errMsgs);
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
      await sendMessage(input, pendingFiles, results);
    } else { await sendMessage(input); }
  }

  function startNewReclamo() {
    setActiveReclamo(null);
    setMessages([]);
    setView("chat");
    setTimeout(() => sendMessage("Hola, quiero presentar una reclamación ante mi EPS."), 100);
  }

  function openReclamo(r) {
    setActiveReclamo(r);
    setMessages(Array.isArray(r.mensajes) ? r.mensajes : []);
    setView("chat");
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
      `Notificaciones: ${doc.solicitanteContacto}`, "",
      "Atentamente,", "", doc.solicitanteNombre, doc.solicitanteDoc, "",
      "---", "Borrador tecnológico. Revisar antes de radicar.",
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `reclamo-eps-${Date.now()}.txt`; a.click();
  }

  if (checkingAuth) return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7f5", color: "#888" }}>
      Cargando...
    </div>
  );

  if (!user) return <AuthScreen onAuth={u => { setUser(u); setView("historial"); }} />;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#f5f7f5" }}>
      <style>{`
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .msg-in{animation:fadeIn 0.25s ease}
        textarea:focus{outline:none}
        button:active{transform:scale(0.97)}
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e8e2", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: "#fff", fontWeight: 800 }}>+</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#1a1a1a" }}>Reclamaciones EPS</div>
          <div style={{ fontSize: 11, color: "#2d8c5e" }}>Colombia · Etapa 3 · Chat + Docs + Historial</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {saving && <span style={{ fontSize: 11, color: "#888" }}>Guardando...</span>}
          {/* Tabs */}
          {["historial","chat"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 13, border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer",
              background: view === v ? "#2d8c5e" : "transparent",
              color: view === v ? "#fff" : "#888", fontWeight: view === v ? 700 : 400,
            }}>{v === "historial" ? "📋 Historial" : "💬 Chat"}</button>
          ))}
          <button onClick={signOut} style={{ fontSize: 12, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Vistas */}
      {view === "historial" ? (
        <HistorialPanel userId={user.id} onOpen={openReclamo} onNew={startNewReclamo} />
      ) : (
        <>
          {/* Banner reclamo activo */}
          {activeReclamo?.eps && (
            <div style={{ background: "#e8f4ee", borderBottom: "1px solid #c8e6d4", padding: "7px 20px", fontSize: 13, color: "#2d4a38", display: "flex", alignItems: "center", gap: 10 }}>
              <span>📋 {activeReclamo.eps}{activeReclamo.tipo_problema ? ` · ${activeReclamo.tipo_problema}` : ""}</span>
              {activeReclamo.estado && <Badge estado={activeReclamo.estado} />}
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {activeReclamo.id && (
                  <select
                    value={activeReclamo.estado || "en_proceso"}
                    onChange={async e => {
                      const estado = e.target.value;
                      await supabase.from("reclamos").update({ estado }).eq("id", activeReclamo.id);
                      setActiveReclamo(prev => ({ ...prev, estado }));
                    }}
                    style={{ fontSize: 12, border: "1px solid #c8e6d4", borderRadius: 8, padding: "3px 8px", background: "#fff", cursor: "pointer" }}
                  >
                    <option value="en_proceso">En proceso</option>
                    <option value="respondido">Respondido</option>
                    <option value="escalado">Escalado</option>
                    <option value="cerrado">Cerrado</option>
                  </select>
                )}
                <button onClick={() => setView("historial")} style={{ fontSize: 12, color: "#2d8c5e", background: "none", border: "none", cursor: "pointer" }}>← Historial</button>
              </div>
            </div>
          )}

          {/* Chat */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {messages.length === 0 && !loading && (
                <div style={{ textAlign: "center", color: "#888", paddingTop: 40, fontSize: 14 }}>
                  La conversación aparecerá aquí...
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className="msg-in">
                  <MessageBubble msg={msg} onDownload={downloadDocument} />
                </div>
              ))}
              {analyzingDoc && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }} className="msg-in">
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#4a6fa5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>📄</div>
                  <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", border: "1px solid #c8d8f0", padding: "10px 14px", fontSize: 14, color: "#4a6fa5" }}>Analizando documento...</div>
                </div>
              )}
              {loading && !analyzingDoc && (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14 }} className="msg-in">
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>IA</div>
                  <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", border: "1px solid #e8ede9", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", minWidth: 60 }}>
                    {streamingText ? <div style={{ padding: "10px 14px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", maxWidth: 500 }}>{stripBlocks(streamingText)}</div> : <TypingDots />}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Input */}
          <div style={{ background: "#fff", borderTop: "1px solid #e0e8e2", padding: "10px 16px", flexShrink: 0 }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {pendingFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {pendingFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0f9f4", border: "1px solid #c8e6d4", borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
                      <span>{f.type.startsWith("image/") ? "🖼" : "📄"}</span>
                      <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => setPendingFiles(prev => prev.filter((_,j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ display: "block", border: "1.5px dashed #c8ddd3", borderRadius: 10, padding: "8px 14px", textAlign: "center", cursor: "pointer", fontSize: 12, color: "#888", marginBottom: 8, background: "#f9faf9" }}>
                <input type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} onChange={e => { setPendingFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ""; }} />
                📎 Adjuntar orden médica, fórmula, autorización o respuesta EPS (imagen o PDF)
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={pendingFiles.length > 0 ? "Añade un comentario (opcional)..." : "Escribe aquí... (Enter para enviar)"}
                  rows={1}
                  style={{ flex: 1, border: "1.5px solid #dde8e0", borderRadius: 12, padding: "10px 14px", fontSize: 14, resize: "none", fontFamily: "system-ui", lineHeight: 1.5, background: "#f9faf9", maxHeight: 100, overflowY: "auto" }}
                  onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
                />
                <button onClick={handleSend} disabled={(!input.trim() && pendingFiles.length === 0) || loading || analyzingDoc}
                  style={{ background: (input.trim() || pendingFiles.length > 0) && !loading && !analyzingDoc ? "#2d8c5e" : "#c8ddd3", color: "#fff", border: "none", borderRadius: 12, width: 42, height: 42, fontSize: 17, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {analyzingDoc ? "⏳" : "↑"}
                </button>
              </div>
              <div style={{ fontSize: 11, color: "#aaa", marginTop: 5, textAlign: "center" }}>
                Conversación guardada automáticamente · Shift+Enter para salto de línea
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
