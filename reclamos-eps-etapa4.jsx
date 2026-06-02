import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "jspdf";

// ─────────────────────────────────────────────
// CONFIGURACIÓN — reemplaza con tus credenciales
// ─────────────────────────────────────────────
const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
const SUPABASE_ANON_KEY = "TU_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─────────────────────────────────────────────
// SQL ADICIONAL PARA ETAPA 4
// Ejecuta en el SQL Editor de Supabase:
//
// alter table reclamos add column if not exists numero_radicado text;
// alter table reclamos add column if not exists fecha_radicacion timestamptz;
// alter table reclamos add column if not exists alerta_vencimiento boolean default false;
// alter table reclamos add column if not exists historial_seguimiento jsonb default '[]';
//
// create table if not exists alertas (
//   id uuid default gen_random_uuid() primary key,
//   user_id uuid references auth.users(id) on delete cascade,
//   reclamo_id uuid references reclamos(id) on delete cascade,
//   tipo text,  -- 'vencimiento' | 'escalamiento' | 'respuesta_esperada'
//   mensaje text,
//   leida boolean default false,
//   fecha_alerta timestamptz default now()
// );
// alter table alertas enable row level security;
// create policy "Users manage own alertas"
//   on alertas for all using (auth.uid() = user_id);
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// PROMPTS
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

const AGENTE_SEGUIMIENTO_PROMPT = `Eres el Agente de Seguimiento de una plataforma de reclamaciones EPS en Colombia.
Analiza el estado del reclamo y genera un análisis en formato JSON estricto.

DATOS DEL RECLAMO:
{DATOS_RECLAMO}

Devuelve ÚNICAMENTE este bloque JSON, sin texto adicional:

---SEGUIMIENTO_INICIO---
{
  "dias_transcurridos": 0,
  "plazo_maximo_dias": 15,
  "porcentaje_plazo": 0,
  "estado_plazo": "a_tiempo | en_riesgo | vencido",
  "alerta_principal": "texto de la alerta más importante",
  "acciones_recomendadas": ["acción 1", "acción 2"],
  "siguiente_documento": "PQRS | DERECHO DE PETICIÓN | RECURSO DE APELACIÓN | TUTELA",
  "mensaje_usuario": "mensaje empático y claro para el usuario",
  "escalar_ahora": false,
  "motivo_escalamiento": ""
}
---SEGUIMIENTO_FIN---

Reglas de plazo según tipo:
- PQRS: 15 días hábiles
- DERECHO DE PETICIÓN: 15 días hábiles
- SOLICITUD PRIORITARIA: 10 días hábiles
- URGENCIA ALTO o CRÍTICO: 5 días hábiles
Cuando el plazo supere el 80% → estado "en_riesgo". Cuando supere 100% → "vencido" y escalar_ahora = true.`;

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
  const addLine = (text, size = 10, bold = false, color = [30, 30, 30]) => {
    pdf.setFontSize(size); pdf.setFont("helvetica", bold ? "bold" : "normal"); pdf.setTextColor(...color);
    const lines = pdf.splitTextToSize(text || "", contentW);
    checkPage(lines.length * size * 0.42 + 2);
    pdf.text(lines, margin, y); y += lines.length * size * 0.42 + 1;
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
  addLine(`Yo, ${doc.solicitanteNombre || "[NOMBRE]"}, identificado(a) con ${doc.solicitanteDoc || "[DOC]"}, me permito elevar ante ustedes la siguiente reclamación:`, 10, false, [50, 50, 50]);
  addSection("I.  HECHOS", doc.hechos, [45, 140, 94]);
  addSection("II.  FUNDAMENTOS DE DERECHO", doc.fundamentosDerecho, [74, 63, 140]);
  addSection("III.  SOLICITUDES", doc.solicitudes, [45, 140, 94]);
  addSection("IV.  ADVERTENCIA LEGAL", doc.advertenciaLegal, [180, 100, 0]);
  addSection("V.  DOCUMENTOS ANEXOS", doc.anexos, [45, 140, 94]);
  if (doc.siguientePaso) { y += 3; addLine("Siguiente paso:", 10, true, [180, 100, 0]); addLine(doc.siguientePaso, 10, false, [100, 70, 0]); }
  y += 10; checkPage(30); addLine("Atentamente,", 10); y += 8; addLine(doc.solicitanteNombre || "[NOMBRE]", 11, true); addLine(doc.solicitanteDoc || "", 10);
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
  const body = encodeURIComponent(`Señores ${doc.destinatario || "EPS"},\n\nASUNTO: ${doc.asunto || ""}\n\n${doc.solicitanteNombre || ""}, ${doc.solicitanteDoc || ""}, ${doc.solicitanteContacto || ""}\n\nAdjunto PDF con hechos y fundamentos de derecho completos.\n\nSolicito respuesta en los plazos legales.\n\nAtentamente,\n${doc.solicitanteNombre || ""}`);
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

function parseSeguimiento(text) {
  if (!text) return null;
  const s = text.indexOf("---SEGUIMIENTO_INICIO---");
  const e = text.indexOf("---SEGUIMIENTO_FIN---");
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(text.slice(s + 24, e).trim()); } catch { return null; }
}

function stripBlocks(text) {
  if (!text) return "";
  let t = text;
  const ds = t.indexOf("---DOCUMENTO_INICIO---"); const de = t.indexOf("---DOCUMENTO_FIN---");
  if (ds !== -1 && de !== -1) t = (t.slice(0, ds) + t.slice(de + 19)).trim();
  const es = t.indexOf("---EXTRACCION_INICIO---"); const ee = t.indexOf("---EXTRACCION_FIN---");
  if (es !== -1 && ee !== -1) t = (t.slice(0, es) + t.slice(ee + 20)).trim();
  const ss = t.indexOf("---SEGUIMIENTO_INICIO---"); const se = t.indexOf("---SEGUIMIENTO_FIN---");
  if (ss !== -1 && se !== -1) t = (t.slice(0, ss) + t.slice(se + 21)).trim();
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

function calcDiasTranscurridos(fecha) {
  if (!fecha) return 0;
  const ms = Date.now() - new Date(fecha).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function calcPlazoMaximo(tipo, urgencia) {
  if (urgencia === "CRÍTICO" || urgencia === "ALTO") return 5;
  if (tipo === "SOLICITUD PRIORITARIA") return 10;
  return 15;
}

const ESTADO_COLORS = {
  en_proceso: { bg: "#fff8e1", color: "#b8860b", label: "En proceso" },
  respondido: { bg: "#e8f4ee", color: "#2d8c5e", label: "Respondido" },
  cerrado: { bg: "#f0f0f0", color: "#666", label: "Cerrado" },
  escalado: { bg: "#fce8e8", color: "#c0392b", label: "Escalado" },
};

// ─────────────────────────────────────────────
// COMPONENTE: BARRA DE PLAZO
// ─────────────────────────────────────────────
function PlazoBarra({ dias, plazoMax, porcentaje }) {
  const pct = Math.min(porcentaje || Math.round((dias / plazoMax) * 100), 100);
  const color = pct >= 100 ? "#c0392b" : pct >= 80 ? "#e67e22" : "#2d8c5e";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#666", marginBottom: 5 }}>
        <span>{dias} día{dias !== 1 ? "s" : ""} transcurrido{dias !== 1 ? "s" : ""}</span>
        <span style={{ color }}>{pct}% del plazo</span>
      </div>
      <div style={{ background: "#e8ede9", borderRadius: 8, height: 8, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", borderRadius: 8,
          background: pct >= 100 ? "#c0392b" : pct >= 80 ? "#e67e22" : "#2d8c5e",
          transition: "width 0.6s ease",
        }} />
      </div>
      <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
        Plazo máximo: {plazoMax} días hábiles
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: CARD DE SEGUIMIENTO IA
// ─────────────────────────────────────────────
function SeguimientoCard({ seg, onEscalar }) {
  if (!seg) return null;
  const esVencido = seg.estado_plazo === "vencido";
  const esRiesgo = seg.estado_plazo === "en_riesgo";
  const borderColor = esVencido ? "#c0392b" : esRiesgo ? "#e67e22" : "#2d8c5e";
  const bgColor = esVencido ? "#fce8e8" : esRiesgo ? "#fff3e0" : "#f0f9f4";
  return (
    <div style={{ background: bgColor, border: `1.5px solid ${borderColor}`, borderRadius: 14, padding: "16px 18px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{esVencido ? "🚨" : esRiesgo ? "⚠️" : "📊"}</span>
        <span style={{ fontWeight: 700, color: borderColor, fontSize: 14 }}>
          {esVencido ? "Plazo vencido — Acción inmediata requerida" : esRiesgo ? "Plazo en riesgo" : "Seguimiento del caso"}
        </span>
      </div>
      <PlazoBarra dias={seg.dias_transcurridos} plazoMax={seg.plazo_maximo_dias} porcentaje={seg.porcentaje_plazo} />
      {seg.alerta_principal && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", marginTop: 12, borderLeft: `3px solid ${borderColor}`, fontSize: 14, color: "#333", lineHeight: 1.5 }}>
          {seg.alerta_principal}
        </div>
      )}
      {seg.mensaje_usuario && (
        <div style={{ fontSize: 13, color: "#555", marginTop: 10, lineHeight: 1.6 }}>{seg.mensaje_usuario}</div>
      )}
      {seg.acciones_recomendadas?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 6 }}>ACCIONES RECOMENDADAS</div>
          {seg.acciones_recomendadas.map((a, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 5, fontSize: 13, color: "#333" }}>
              <span style={{ color: borderColor, fontWeight: 700, flexShrink: 0 }}>→</span>
              <span>{a}</span>
            </div>
          ))}
        </div>
      )}
      {seg.siguiente_documento && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", marginTop: 10, fontSize: 13, color: "#333" }}>
          <strong>Siguiente documento sugerido:</strong> {seg.siguiente_documento}
        </div>
      )}
      {seg.escalar_ahora && (
        <button onClick={onEscalar} style={{
          width: "100%", marginTop: 12, background: "#c0392b", color: "#fff",
          border: "none", borderRadius: 10, padding: "10px", fontSize: 14,
          fontWeight: 700, cursor: "pointer",
        }}>
          🚨 Escalar reclamo ahora
        </button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: PANEL DE ALERTAS
// ─────────────────────────────────────────────
function AlertasPanel({ userId, onClose }) {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlertas();
  }, [userId]);

  async function loadAlertas() {
    setLoading(true);
    const { data } = await supabase
      .from("alertas")
      .select("*, reclamos(eps, tipo_problema)")
      .eq("user_id", userId)
      .order("fecha_alerta", { ascending: false })
      .limit(20);
    setAlertas(data || []);
    setLoading(false);
  }

  async function marcarLeida(id) {
    await supabase.from("alertas").update({ leida: true }).eq("id", id);
    setAlertas(prev => prev.map(a => a.id === id ? { ...a, leida: true } : a));
  }

  async function marcarTodasLeidas() {
    await supabase.from("alertas").update({ leida: true }).eq("user_id", userId).eq("leida", false);
    setAlertas(prev => prev.map(a => ({ ...a, leida: true })));
  }

  const noLeidas = alertas.filter(a => !a.leida).length;

  return (
    <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 360, background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #e0e8e2", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>🔔 Alertas</span>
        {noLeidas > 0 && (
          <span style={{ background: "#c0392b", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{noLeidas}</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {noLeidas > 0 && (
            <button onClick={marcarTodasLeidas} style={{ fontSize: 12, color: "#2d8c5e", background: "none", border: "none", cursor: "pointer" }}>Marcar todas leídas</button>
          )}
          <button onClick={onClose} style={{ fontSize: 20, color: "#888", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>Cargando alertas...</div>
        ) : alertas.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>Sin alertas por el momento</div>
        ) : (
          alertas.map(a => {
            const tipoIcon = { vencimiento: "🚨", escalamiento: "⚡", respuesta_esperada: "📋" }[a.tipo] || "🔔";
            return (
              <div key={a.id} onClick={() => marcarLeida(a.id)} style={{
                background: a.leida ? "#f9faf9" : "#fff8e1",
                border: `1px solid ${a.leida ? "#e8ede9" : "#f9c74f"}`,
                borderRadius: 10, padding: "12px 14px", marginBottom: 8,
                cursor: "pointer", opacity: a.leida ? 0.7 : 1,
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16 }}>{tipoIcon}</span>
                  <div style={{ flex: 1 }}>
                    {a.reclamos && (
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#2d8c5e", marginBottom: 3 }}>
                        {a.reclamos.eps} — {a.reclamos.tipo_problema}
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "#333", lineHeight: 1.5 }}>{a.mensaje}</div>
                    <div style={{ fontSize: 11, color: "#aaa", marginTop: 4 }}>
                      {new Date(a.fecha_alerta).toLocaleDateString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {!a.leida && <span style={{ marginLeft: 8, color: "#e67e22", fontWeight: 700 }}>● Nuevo</span>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: DASHBOARD DE SEGUIMIENTO
// ─────────────────────────────────────────────
function SeguimientoDashboard({ reclamos, onOpen, onAnalizar, analizando }) {
  const vencidos = reclamos.filter(r => {
    if (!r.fecha_radicacion || r.estado === "cerrado" || r.estado === "respondido") return false;
    const dias = calcDiasTranscurridos(r.fecha_radicacion);
    const max = calcPlazoMaximo(r.tipo_documento, r.nivel_urgencia);
    return dias >= max;
  });
  const enRiesgo = reclamos.filter(r => {
    if (!r.fecha_radicacion || r.estado === "cerrado" || r.estado === "respondido") return false;
    const dias = calcDiasTranscurridos(r.fecha_radicacion);
    const max = calcPlazoMaximo(r.tipo_documento, r.nivel_urgencia);
    const pct = (dias / max) * 100;
    return pct >= 80 && pct < 100;
  });
  const activos = reclamos.filter(r => r.estado === "en_proceso").length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        {/* Métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "Total", val: reclamos.length, color: "#4a6fa5" },
            { label: "Activos", val: activos, color: "#2d8c5e" },
            { label: "En riesgo", val: enRiesgo.length, color: "#e67e22" },
            { label: "Vencidos", val: vencidos.length, color: "#c0392b" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "14px 12px", border: `1.5px solid ${val > 0 && (label === "Vencidos" || label === "En riesgo") ? color : "#e0e8e2"}`, textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Alertas críticas */}
        {vencidos.length > 0 && (
          <div style={{ background: "#fce8e8", border: "1.5px solid #c0392b", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: "#c0392b", fontSize: 14, marginBottom: 10 }}>🚨 {vencidos.length} reclamo{vencidos.length > 1 ? "s" : ""} con plazo vencido</div>
            {vencidos.map(r => (
              <div key={r.id} onClick={() => onOpen(r)} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", marginBottom: 6, cursor: "pointer", fontSize: 13 }}>
                <strong>{r.eps}</strong> — {r.tipo_problema}
                <div style={{ fontSize: 11, color: "#c0392b", marginTop: 2 }}>
                  {calcDiasTranscurridos(r.fecha_radicacion)} días transcurridos · Plazo: {calcPlazoMaximo(r.tipo_documento, r.nivel_urgencia)} días
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Lista todos los reclamos */}
        <div style={{ fontWeight: 700, fontSize: 14, color: "#333", marginBottom: 12 }}>Todos los reclamos</div>
        {reclamos.length === 0 ? (
          <div style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>Sin reclamos registrados</div>
        ) : (
          reclamos.map(r => {
            const dias = r.fecha_radicacion ? calcDiasTranscurridos(r.fecha_radicacion) : null;
            const max = calcPlazoMaximo(r.tipo_documento, r.nivel_urgencia);
            const pct = dias !== null ? Math.min(Math.round((dias / max) * 100), 100) : null;
            const estadoColors = ESTADO_COLORS[r.estado] || ESTADO_COLORS.en_proceso;
            return (
              <div key={r.id} onClick={() => onOpen(r)} style={{
                background: "#fff", borderRadius: 14, border: "1px solid #e0e8e2",
                padding: "16px 18px", marginBottom: 10, cursor: "pointer",
                borderLeft: pct >= 100 ? "4px solid #c0392b" : pct >= 80 ? "4px solid #e67e22" : "4px solid #e0e8e2",
              }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>{r.eps || "EPS no definida"}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{r.tipo_problema}{r.tipo_documento ? ` · ${r.tipo_documento}` : ""}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ background: estadoColors.bg, color: estadoColors.color, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>{estadoColors.label}</span>
                    {r.nivel_urgencia && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: r.nivel_urgencia === "CRÍTICO" ? "#fce8e8" : r.nivel_urgencia === "ALTO" ? "#fff3e0" : "#f0f0f0",
                        color: r.nivel_urgencia === "CRÍTICO" ? "#c0392b" : r.nivel_urgencia === "ALTO" ? "#e67e22" : "#666",
                      }}>{r.nivel_urgencia}</span>
                    )}
                  </div>
                </div>
                {dias !== null && r.estado === "en_proceso" && (
                  <div style={{ marginBottom: 8 }}>
                    <PlazoBarra dias={dias} plazoMax={max} porcentaje={pct} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#aaa" }}>
                    {r.fecha_radicacion
                      ? `Radicado: ${new Date(r.fecha_radicacion).toLocaleDateString("es-CO")}`
                      : `Creado: ${new Date(r.fecha_creacion).toLocaleDateString("es-CO")}`}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); onAnalizar(r); }}
                    disabled={analizando === r.id}
                    style={{
                      fontSize: 12, background: "none", border: "1px solid #2d8c5e",
                      color: "#2d8c5e", borderRadius: 8, padding: "4px 10px",
                      cursor: "pointer", opacity: analizando === r.id ? 0.6 : 1,
                    }}
                  >
                    {analizando === r.id ? "Analizando..." : "📊 Analizar"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTES UI REUTILIZABLES
// ─────────────────────────────────────────────
function Badge({ estado }) {
  const c = ESTADO_COLORS[estado] || ESTADO_COLORS.en_proceso;
  return <span style={{ background: c.bg, color: c.color, fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20 }}>{c.label}</span>;
}

function ExtraccionCard({ ext }) {
  const fields = [
    ["Tipo", ext.tipo_documento], ["Fecha", ext.fecha_documento],
    ["Paciente", ext.nombre_paciente],
    ["Documento", ext.numero_doc_paciente !== "No identificado" ? `${ext.tipo_doc_paciente} ${ext.numero_doc_paciente}` : null],
    ["EPS", ext.eps], ["IPS / Médico", ext.ips_medico], ["Ciudad", ext.ciudad],
    ["Servicio", ext.servicio_solicitado], ["Radicado", ext.numero_radicado],
  ].filter(([, v]) => v && v !== "No identificado");
  return (
    <div style={{ background: "linear-gradient(135deg,#f0f4ff,#e8f4fd)", border: "1.5px solid #4a6fa5", borderRadius: 14, padding: "14px 18px", marginTop: 10, fontSize: 13 }}>
      <span style={{ background: "#4a6fa5", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: 1 }}>DOCUMENTO ANALIZADO</span>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 14px", marginTop: 10 }}>
        {fields.map(([k, v]) => <div key={k}><span style={{ color: "#4a6fa5", fontWeight: 700 }}>{k}:</span> {v}</div>)}
      </div>
      {ext.resumen_para_reclamo && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "8px 12px", borderLeft: "3px solid #4a6fa5", marginTop: 8, color: "#333", lineHeight: 1.5 }}>{ext.resumen_para_reclamo}</div>
      )}
      {ext.datos_faltantes && ext.datos_faltantes !== "No identificado" && (
        <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", marginTop: 6, color: "#7a6000", fontSize: 12 }}>⚠️ <strong>Faltantes:</strong> {ext.datos_faltantes}</div>
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
        <button onClick={() => generatePDF(doc)} style={{ background: "#fff", color: "#2d8c5e", border: "1.5px solid #2d8c5e", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>⬇ Solo PDF</button>
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
            <span style={{ color: "#888", width: 60 }}>📞 Tel</span><span style={{ color: "#333" }}>{epsInfo.telefono}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#888", width: 60 }}>🌐 Portal</span>
            <a href={epsInfo.pqrsPortal} target="_blank" rel="noreferrer" style={{ color: "#2d8c5e" }}>Radicar en portal EPS →</a>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#7a6000" }}>⚠️ Busca el correo de PQRS de tu EPS en su página oficial.</div>
      )}
      <div style={{ borderTop: "1px solid #c8e6d4", paddingTop: 10, marginTop: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>ESCALAMIENTO (si la EPS no responde)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href={SUPERSALUD.pqrdPortal} target="_blank" rel="noreferrer" style={{ background: "#4a6fa5", color: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", flex: 1, textAlign: "center" }}>🏛 Supersalud (PQRD online)</a>
          <a href={`tel:${SUPERSALUD.telefono}`} style={{ background: "#fff", color: "#4a6fa5", border: "1.5px solid #4a6fa5", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>📞 {SUPERSALUD.telefono}</a>
        </div>
        <a href={DEFENSORIA.portal} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 8, background: "#fce8e8", color: "#c0392b", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>⚖️ Defensoría del Pueblo — Tutela gratuita</a>
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#aaa", lineHeight: 1.4 }}>
        "Enviar al EPS" descarga el PDF y abre tu correo con destinatario pre-llenado. Solo adjunta el PDF y envía.
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
  const seg = !isUser ? parseSeguimiento(msg.content) : null;
  const displayText = stripBlocks(msg.content);
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, alignItems: "flex-end", gap: 8 }}>
      {!isUser && <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>IA</div>}
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
        {seg && <SeguimientoCard seg={seg} onEscalar={() => {}} />}
        {doc && <DocumentCard doc={doc} onDownload={() => generatePDF(doc)} />}
        {doc && <PanelEnvio doc={doc} />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px" }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#2d8c5e", animation: "bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />)}
    </div>
  );
}

// ─────────────────────────────────────────────
// PANTALLA DE AUTH
// ─────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth() {
    if (!email || !password) { setError("Ingresa correo y contraseña."); return; }
    setLoading(true); setError("");
    try {
      const fn = isRegister ? supabase.auth.signUp : supabase.auth.signInWithPassword;
      const { data, error: e } = await (isRegister
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password }));
      if (e) { setError(e.message); return; }
      if (data.user) onAuth(data.user);
    } catch { setError("Error de conexión."); } finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7f5", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", width: "100%", maxWidth: 360, border: "1px solid #e0e8e2" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏥</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a1a" }}>Reclamaciones EPS</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Etapa 4 — Seguimiento inteligente</div>
        </div>
        <input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)}
          style={{ width: "100%", border: "1.5px solid #dde8e0", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
        <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAuth()}
          style={{ width: "100%", border: "1.5px solid #dde8e0", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }} />
        {error && <div style={{ color: "#c0392b", fontSize: 12, marginBottom: 10 }}>{error}</div>}
        <button onClick={handleAuth} disabled={loading} style={{ width: "100%", background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "..." : isRegister ? "Crear cuenta" : "Ingresar"}
        </button>
        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#888" }}>
          {isRegister ? "¿Ya tienes cuenta?" : "¿Primera vez?"}{" "}
          <span style={{ color: "#2d8c5e", cursor: "pointer", fontWeight: 600 }} onClick={() => setIsRegister(!isRegister)}>
            {isRegister ? "Ingresar" : "Crear cuenta"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// APP PRINCIPAL — ETAPA 4
// ─────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [view, setView] = useState("seguimiento"); // seguimiento | chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [analyzingDoc, setAnalyzingDoc] = useState(false);
  const [reclamos, setReclamos] = useState([]);
  const [activeReclamo, setActiveReclamo] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showAlertas, setShowAlertas] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [analizandoId, setAnalizandoId] = useState(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user || null);
      setCheckingAuth(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) { loadReclamos(); loadNoLeidas(); }
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function loadReclamos() {
    const { data } = await supabase
      .from("reclamos").select("*").eq("user_id", user.id)
      .order("fecha_creacion", { ascending: false });
    setReclamos(data || []);
  }

  async function loadNoLeidas() {
    const { count } = await supabase
      .from("alertas").select("*", { count: "exact", head: true })
      .eq("user_id", user.id).eq("leida", false);
    setNoLeidas(count || 0);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null); setMessages([]); setActiveReclamo(null);
  }

  // ── Análisis de seguimiento con IA ──
  async function analizarSeguimiento(reclamo) {
    setAnalizandoId(reclamo.id);
    try {
      const datosReclamo = JSON.stringify({
        eps: reclamo.eps,
        tipo_problema: reclamo.tipo_problema,
        tipo_documento: reclamo.tipo_documento,
        nivel_urgencia: reclamo.nivel_urgencia,
        estado: reclamo.estado,
        fecha_radicacion: reclamo.fecha_radicacion,
        fecha_creacion: reclamo.fecha_creacion,
        numero_radicado: reclamo.numero_radicado,
        hoy: new Date().toISOString(),
      });

      const prompt = AGENTE_SEGUIMIENTO_PROMPT.replace("{DATOS_RECLAMO}", datosReclamo);
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const texto = data.content?.map(b => b.text || "").join("") || "";
      const seg = parseSeguimiento(texto);
      if (seg) {
        // Guardar en historial_seguimiento
        const historial = Array.isArray(reclamo.historial_seguimiento) ? reclamo.historial_seguimiento : [];
        historial.unshift({ fecha: new Date().toISOString(), analisis: seg });
        await supabase.from("reclamos").update({
          historial_seguimiento: historial.slice(0, 10),
          alerta_vencimiento: seg.estado_plazo === "vencido",
          estado: seg.escalar_ahora && reclamo.estado === "en_proceso" ? "escalado" : reclamo.estado,
        }).eq("id", reclamo.id);
        // Crear alerta si hay escalamiento
        if (seg.escalar_ahora) {
          await supabase.from("alertas").insert({
            user_id: user.id, reclamo_id: reclamo.id,
            tipo: "escalamiento",
            mensaje: `Reclamo ante ${reclamo.eps} debe escalarse. ${seg.alerta_principal}`,
          });
          setNoLeidas(prev => prev + 1);
        }
        // Abrir en chat con el análisis
        openReclamo(reclamo, seg);
        await loadReclamos();
      }
    } catch (err) {
      console.error("Error análisis seguimiento:", err);
    } finally {
      setAnalizandoId(null);
    }
  }

  function openReclamo(r, segAnalisis) {
    setActiveReclamo(r);
    const msgs = Array.isArray(r.mensajes) ? r.mensajes : [];
    if (segAnalisis) {
      const msgSeg = {
        role: "assistant",
        content: `---SEGUIMIENTO_INICIO---\n${JSON.stringify(segAnalisis, null, 2)}\n---SEGUIMIENTO_FIN---`,
      };
      setMessages([...msgs, msgSeg]);
    } else {
      setMessages(msgs);
    }
    setView("chat");
  }

  function startNewReclamo() {
    setActiveReclamo(null);
    setMessages([]);
    setView("chat");
    setTimeout(async () => {
      await sendMessage("Hola, quiero hacer una reclamación", null, null, true);
    }, 100);
  }

  async function sendMessage(text, files, base64Files, isNew = false) {
    const trimmed = (text || "").trim();
    if (!trimmed && (!files || files.length === 0)) return;
    setLoading(true);
    setStreamingText("");

    const userMsg = { role: "user", content: trimmed };
    if (files?.[0]) userMsg.fileInfo = { name: files[0].name, type: files[0].type };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput(""); setPendingFiles([]);

    try {
      // Si hay archivos, primero analiza con agente documental
      if (files?.length > 0 && base64Files?.length > 0) {
        setAnalyzingDoc(true);
        const fileContent = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f.type.startsWith("image/")) {
            fileContent.push({ type: "image", source: { type: "base64", media_type: f.type, data: base64Files[i] } });
          } else if (f.type === "application/pdf") {
            fileContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Files[i] } });
          }
        }
        if (trimmed) fileContent.push({ type: "text", text: trimmed });

        const docResp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514", max_tokens: 1000,
            messages: [{ role: "user", content: [{ type: "text", text: AGENTE_DOCUMENTAL_PROMPT }, ...fileContent] }],
          }),
        });
        const docData = await docResp.json();
        const docText = docData.content?.map(b => b.text || "").join("") || "";
        const ext = parseExtraccion(docText);
        setAnalyzingDoc(false);
        const extMsg = { role: "assistant", content: docText };
        const withExt = [...newMessages, extMsg];
        setMessages(withExt);

        if (ext?.resumen_para_reclamo) {
          const resMsg = { role: "user", content: `Documento analizado. Resumen: ${ext.resumen_para_reclamo}. ${trimmed || "¿Puedes ayudarme a preparar el reclamo?"}` };
          await callMainAgent([...withExt, resMsg]);
        }
      } else {
        await callMainAgent(newMessages);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Ocurrió un error. Por favor intenta nuevamente." }]);
    } finally {
      setLoading(false); setAnalyzingDoc(false); setStreamingText("");
    }
  }

  async function callMainAgent(msgs) {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514", max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: msgs.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });

    let full = "";
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d.type === "content_block_delta") { full += d.delta.text || ""; setStreamingText(full); }
          } catch {}
        }
      }
    }

    const doc = parseDocument(full);
    const finalMsg = { role: "assistant", content: full };
    const finalMsgs = [...msgs, finalMsg];
    setMessages(finalMsgs);
    setStreamingText("");

    // Detectar info del reclamo y guardar
    await saveReclamo(finalMsgs, doc, full);
  }

  async function saveReclamo(msgs, doc) {
    setSaving(true);
    try {
      const urgMatch = msgs.find(m => m.role === "assistant" && /CRÍTICO|ALTO|MEDIO|BAJO/.test(m.content));
      const urgencia = urgMatch?.content?.match(/\b(CRÍTICO|ALTO|MEDIO|BAJO)\b/)?.[0] || null;
      const epsMatch = msgs.find(m => m.role === "user");
      const tipoMatch = msgs.find(m => m.role === "assistant" && /cita|medicamento|cirugía|examen|autorización/i.test(m.content));

      const payload = {
        user_id: user.id,
        mensajes: msgs.slice(-30),
        estado: activeReclamo?.estado || "en_proceso",
        nivel_urgencia: urgencia || activeReclamo?.nivel_urgencia,
        ...(doc && {
          tipo_documento: doc.tipo,
          eps: doc.destinatario || activeReclamo?.eps,
          documento_generado: doc,
          fecha_radicacion: activeReclamo?.fecha_radicacion || new Date().toISOString(),
          fecha_respuesta_esperada: (() => {
            const d = new Date();
            d.setDate(d.getDate() + calcPlazoMaximo(doc.tipo, urgencia));
            return d.toISOString();
          })(),
        }),
      };

      if (activeReclamo?.id) {
        await supabase.from("reclamos").update(payload).eq("id", activeReclamo.id);
        setActiveReclamo(prev => ({ ...prev, ...payload }));
      } else {
        const { data } = await supabase.from("reclamos").insert([payload]).select().single();
        if (data) setActiveReclamo(data);
      }
      await loadReclamos();
    } catch (err) {
      console.error("Error guardando:", err);
    } finally { setSaving(false); }
  }

  async function handleSend() {
    if (pendingFiles.length > 0) {
      const b64 = await Promise.all(pendingFiles.map(fileToBase64));
      sendMessage(input, pendingFiles, b64);
    } else {
      sendMessage(input);
    }
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

  if (checkingAuth) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7f5", color: "#888" }}>Cargando...</div>;
  if (!user) return <AuthScreen onAuth={u => { setUser(u); setView("seguimiento"); }} />;

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
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e8e2", padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff", fontWeight: 800 }}>+</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>Reclamaciones EPS</div>
          <div style={{ fontSize: 11, color: "#2d8c5e" }}>Etapa 4 · Seguimiento Inteligente</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
          {saving && <span style={{ fontSize: 11, color: "#888" }}>Guardando...</span>}

          {/* Campana de alertas */}
          <button onClick={() => setShowAlertas(true)} style={{ position: "relative", background: "none", border: "1px solid #dde8e0", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 16 }}>
            🔔
            {noLeidas > 0 && (
              <span style={{ position: "absolute", top: -4, right: -4, background: "#c0392b", color: "#fff", fontSize: 9, fontWeight: 700, width: 16, height: 16, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{noLeidas}</span>
            )}
          </button>

          {/* Tabs */}
          {["seguimiento", "chat"].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontSize: 13, border: "none", borderRadius: 8, padding: "5px 11px", cursor: "pointer",
              background: view === v ? "#2d8c5e" : "transparent",
              color: view === v ? "#fff" : "#888", fontWeight: view === v ? 700 : 400,
            }}>
              {v === "seguimiento" ? "📊 Seguimiento" : "💬 Chat"}
            </button>
          ))}
          <button onClick={signOut} style={{ fontSize: 12, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Vistas */}
      {view === "seguimiento" ? (
        <SeguimientoDashboard
          reclamos={reclamos}
          onOpen={openReclamo}
          onAnalizar={analizarSeguimiento}
          analizando={analizandoId}
        />
      ) : (
        <>
          {activeReclamo?.eps && (
            <div style={{ background: "#e8f4ee", borderBottom: "1px solid #c8e6d4", padding: "7px 16px", fontSize: 13, color: "#2d4a38", display: "flex", alignItems: "center", gap: 10 }}>
              <span>📋 {activeReclamo.eps}{activeReclamo.tipo_problema ? ` · ${activeReclamo.tipo_problema}` : ""}</span>
              <Badge estado={activeReclamo.estado} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {activeReclamo.fecha_radicacion && (
                  <span style={{ fontSize: 11, color: "#666" }}>
                    Radicado {new Date(activeReclamo.fecha_radicacion).toLocaleDateString("es-CO")}
                  </span>
                )}
                <button onClick={() => { setActiveReclamo(null); setMessages([]); startNewReclamo(); }} style={{ fontSize: 12, color: "#2d8c5e", background: "none", border: "none", cursor: "pointer" }}>+ Nuevo</button>
                <button onClick={() => setView("seguimiento")} style={{ fontSize: 12, color: "#888", background: "none", border: "none", cursor: "pointer" }}>← Seguimiento</button>
              </div>
            </div>
          )}

          <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {messages.length === 0 && !loading && (
                <div style={{ textAlign: "center", color: "#888", paddingTop: 40, fontSize: 14 }}>La conversación aparecerá aquí...</div>
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
                  <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", border: "1px solid #e8ede9", minWidth: 60 }}>
                    {streamingText ? <div style={{ padding: "10px 14px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", maxWidth: 500 }}>{stripBlocks(streamingText)}</div> : <TypingDots />}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div style={{ background: "#fff", borderTop: "1px solid #e0e8e2", padding: "10px 16px", flexShrink: 0 }}>
            <div style={{ maxWidth: 680, margin: "0 auto" }}>
              {pendingFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {pendingFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, background: "#f0f9f4", border: "1px solid #c8e6d4", borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
                      <span>{f.type.startsWith("image/") ? "🖼" : "📄"}</span>
                      <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 14, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <label style={{ display: "block", border: "1.5px dashed #c8ddd3", borderRadius: 10, padding: "7px 12px", textAlign: "center", cursor: "pointer", fontSize: 12, color: "#888", marginBottom: 8, background: "#f9faf9" }}>
                <input type="file" accept="image/*,application/pdf" multiple style={{ display: "none" }} onChange={e => { setPendingFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value = ""; }} />
                📎 Adjuntar orden médica, fórmula, autorización o respuesta EPS
              </label>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={pendingFiles.length > 0 ? "Añade un comentario..." : "Escribe aquí... (Enter para enviar)"}
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
                Seguimiento automático activado · Shift+Enter para salto de línea
              </div>
            </div>
          </div>
        </>
      )}

      {/* Panel de alertas */}
      {showAlertas && (
        <>
          <div onClick={() => setShowAlertas(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 999 }} />
          <AlertasPanel userId={user.id} onClose={() => { setShowAlertas(false); loadNoLeidas(); }} />
        </>
      )}
    </div>
  );
}
