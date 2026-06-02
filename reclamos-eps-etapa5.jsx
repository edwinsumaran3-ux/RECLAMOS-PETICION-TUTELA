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
// PROMPTS IA
// ─────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente inteligente de una plataforma de reclamaciones ante EPS en Colombia. Orquestas 6 agentes internos para ayudar al usuario a preparar su reclamo con pleno rigor jurídico. Actúas con tono humano, empático, claro y profesional.

MODO VOZ ACTIVADO: Cuando el usuario hable contigo, da respuestas más cortas y conversacionales. Usa frases naturales. Evita listas largas en modo voz, resume en máximo 3 oraciones antes de hacer una pregunta. Si el usuario quiere el documento completo, responde: "Perfecto. Te lo preparo ahora con todos los fundamentos legales. Espera un momento." y genera el documento.

FLUJO OBLIGATORIO:
1. RECEPCIÓN: Saluda y recolecta información con estas preguntas (una a la vez, de forma conversacional):
   - ¿Cuál es tu EPS?
   - ¿Qué problema tienes? (cita médica / medicamentos / cirugía / examen / autorización / incapacidad / mala atención / otro)
   - ¿Desde cuándo esperas solución?
   - ¿Qué respuesta ha dado la EPS?
   - ¿Tienes documentos? (orden médica, fórmula, radicado, respuesta escrita)
   - ¿Qué quieres que la EPS haga concretamente?

2. RIESGO: Evalúa urgencia. Si es CRÍTICO di primero: "Atención. Por lo que describes, esto puede ser una urgencia médica. Busca atención en urgencias ahora." Luego continúa.
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

6. SEGUIMIENTO: Informa plazos legales en modo conversacional cuando sea por voz:
   - PQRS / Derecho de Petición: 15 días hábiles (Art. 14 Ley 1755/2015)
   - Solicitud Prioritaria: 10 días hábiles
   - Tutela: fallo en 10 días calendario (Art. 29 Decreto 2591/1991)

REGLAS: Nunca inventes datos. Usa [DATO PENDIENTE]. Cita SIEMPRE al menos 3 normas jurídicas vigentes. No asesoría jurídica definitiva. Lenguaje colombiano formal pero conversacional en modo voz.`;

const AGENTE_CRONOLOGIA_PROMPT = `Eres el Agente de Transcripción y Cronología de una plataforma de reclamaciones EPS en Colombia.
El usuario narró su problema por voz. El texto transcrito es:

"{TRANSCRIPCION}"

Tu tarea:
1. Organiza la información en una cronología ordenada.
2. Identifica los datos clave del reclamo.
3. Devuelve ÚNICAMENTE este bloque JSON:

---CRONOLOGIA_INICIO---
{
  "eps": "...",
  "tipo_problema": "...",
  "desde_cuando": "...",
  "respuesta_eps": "...",
  "solicitud_usuario": "...",
  "cronologia": ["evento 1", "evento 2", "..."],
  "datos_faltantes": ["dato 1", "dato 2"],
  "resumen_para_reclamo": "...",
  "nivel_urgencia_detectado": "BAJO | MEDIO | ALTO | CRÍTICO"
}
---CRONOLOGIA_FIN---

Si falta información, escribe "No mencionado". No inventes datos.`;

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
  addLine(`Yo, ${doc.solicitanteNombre || "[NOMBRE]"}, identificado(a) con ${doc.solicitanteDoc || "[DOC]"}, me permito elevar la siguiente reclamación:`, 10, false, [50, 50, 50]);
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

function parseCronologia(text) {
  if (!text) return null;
  const s = text.indexOf("---CRONOLOGIA_INICIO---");
  const e = text.indexOf("---CRONOLOGIA_FIN---");
  if (s === -1 || e === -1) return null;
  try { return JSON.parse(text.slice(s + 23, e).trim()); } catch { return null; }
}

function stripBlocks(text) {
  if (!text) return "";
  let t = text;
  const ds = t.indexOf("---DOCUMENTO_INICIO---"); const de = t.indexOf("---DOCUMENTO_FIN---");
  if (ds !== -1 && de !== -1) t = (t.slice(0, ds) + t.slice(de + 19)).trim();
  const cs = t.indexOf("---CRONOLOGIA_INICIO---"); const ce = t.indexOf("---CRONOLOGIA_FIN---");
  if (cs !== -1 && ce !== -1) t = (t.slice(0, cs) + t.slice(ce + 20)).trim();
  return t;
}

// Texto limpio para TTS — elimina markdown y bloques especiales
function cleanForTTS(text) {
  return stripBlocks(text)
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/---/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 500); // TTS máximo 500 chars por chunk
}

// ─────────────────────────────────────────────
// HOOK: WEB SPEECH API
// ─────────────────────────────────────────────
function useSpeech({ onTranscript, onEnd, lang = "es-CO" }) {
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setSupported(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(r => r[0].transcript).join("");
      onTranscript(transcript, event.results[event.results.length - 1].isFinal);
    };
    rec.onend = () => { setIsListening(false); onEnd?.(); };
    rec.onerror = () => setIsListening(false);
    recognitionRef.current = rec;
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    synthRef.current?.cancel(); // Detener TTS si está hablando
    setIsListening(true);
    try { recognitionRef.current.start(); } catch {}
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text) => {
    const synth = synthRef.current;
    if (!synth) return;
    synth.cancel();
    const clean = cleanForTTS(text);
    if (!clean) return;

    // Dividir en chunks si es largo
    const chunks = clean.match(/.{1,200}(?:\s|$)/g) || [clean];
    setIsSpeaking(true);

    let i = 0;
    function speakNext() {
      if (i >= chunks.length) { setIsSpeaking(false); return; }
      const utt = new SpeechSynthesisUtterance(chunks[i]);
      utt.lang = lang;
      utt.rate = 0.95;
      utt.pitch = 1.0;
      utt.volume = 1.0;
      // Preferir voz en español si está disponible
      const voices = synth.getVoices();
      const esVoice = voices.find(v => v.lang.startsWith("es") && !v.name.includes("Google")) ||
        voices.find(v => v.lang.startsWith("es"));
      if (esVoice) utt.voice = esVoice;
      utt.onend = () => { i++; speakNext(); };
      utt.onerror = () => setIsSpeaking(false);
      synth.speak(utt);
    }
    speakNext();
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  return { isListening, isSpeaking, supported, startListening, stopListening, speak, stopSpeaking };
}

// ─────────────────────────────────────────────
// COMPONENTE: BOTÓN DE VOZ PRINCIPAL
// ─────────────────────────────────────────────
function VozButton({ isListening, isSpeaking, onStart, onStop, onStopSpeaking, disabled }) {
  if (isSpeaking) {
    return (
      <button onClick={onStopSpeaking} style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "#4a6fa5", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, boxShadow: "0 0 0 8px rgba(74,111,165,0.15)",
        animation: "pulseBlue 1.5s ease-in-out infinite",
        flexShrink: 0,
      }}>
        🔊
      </button>
    );
  }
  if (isListening) {
    return (
      <button onClick={onStop} style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "#c0392b", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, boxShadow: "0 0 0 8px rgba(192,57,43,0.2)",
        animation: "pulseRed 0.8s ease-in-out infinite",
        flexShrink: 0,
      }}>
        ⏹
      </button>
    );
  }
  return (
    <button onClick={onStart} disabled={disabled} style={{
      width: 64, height: 64, borderRadius: "50%",
      background: disabled ? "#c8ddd3" : "#2d8c5e",
      border: "none", cursor: disabled ? "default" : "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 26, transition: "all 0.2s", flexShrink: 0,
      boxShadow: disabled ? "none" : "0 4px 16px rgba(45,140,94,0.3)",
    }}>
      🎤
    </button>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: CARD DE CRONOLOGÍA
// ─────────────────────────────────────────────
function CronologiaCard({ cron, onConfirmar }) {
  if (!cron) return null;
  return (
    <div style={{ background: "linear-gradient(135deg,#f0f9f4,#e8f4fd)", border: "1.5px solid #2d8c5e", borderRadius: 16, padding: "18px 20px", marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 18 }}>🎙</span>
        <span style={{ fontWeight: 700, color: "#2d8c5e", fontSize: 14 }}>Cronología organizada de tu relato</span>
        {cron.nivel_urgencia_detectado && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, marginLeft: "auto",
            background: cron.nivel_urgencia_detectado === "CRÍTICO" ? "#fce8e8" : cron.nivel_urgencia_detectado === "ALTO" ? "#fff3e0" : "#f0f9f4",
            color: cron.nivel_urgencia_detectado === "CRÍTICO" ? "#c0392b" : cron.nivel_urgencia_detectado === "ALTO" ? "#e67e22" : "#2d8c5e",
          }}>Urgencia {cron.nivel_urgencia_detectado}</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 14px", fontSize: 13, marginBottom: 12 }}>
        {[["EPS", cron.eps], ["Problema", cron.tipo_problema], ["Desde cuándo", cron.desde_cuando], ["Respuesta EPS", cron.respuesta_eps]].map(([k, v]) => v && v !== "No mencionado" && (
          <div key={k}><span style={{ fontWeight: 700, color: "#2d8c5e" }}>{k}:</span> {v}</div>
        ))}
      </div>
      {cron.cronologia?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 6 }}>EVENTOS EN ORDEN</div>
          {cron.cronologia.map((ev, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 5, fontSize: 13, alignItems: "flex-start" }}>
              <span style={{ background: "#2d8c5e", color: "#fff", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ color: "#333", lineHeight: 1.5 }}>{ev}</span>
            </div>
          ))}
        </div>
      )}
      {cron.datos_faltantes?.length > 0 && cron.datos_faltantes[0] !== "No mencionado" && (
        <div style={{ background: "#fff8e1", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#7a6000" }}>
          ⚠️ <strong>Para completar el reclamo necesito:</strong> {cron.datos_faltantes.join(", ")}
        </div>
      )}
      {cron.resumen_para_reclamo && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", borderLeft: "3px solid #2d8c5e", marginBottom: 14, fontSize: 13, color: "#333", lineHeight: 1.5 }}>
          {cron.resumen_para_reclamo}
        </div>
      )}
      <button onClick={() => onConfirmar(cron)} style={{
        width: "100%", background: "#2d8c5e", color: "#fff", border: "none",
        borderRadius: 10, padding: "11px", fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>
        ✅ Confirmar y preparar el reclamo
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// COMPONENTE: CARD DE DOCUMENTO
// ─────────────────────────────────────────────
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

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 14px" }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#2d8c5e", animation: "bounce 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />)}
    </div>
  );
}

function MessageBubble({ msg, onDownload, onConfirmarCron }) {
  const isUser = msg.role === "user";
  const doc = !isUser ? parseDocument(msg.content) : null;
  const cron = !isUser ? parseCronologia(msg.content) : null;
  const displayText = stripBlocks(msg.content);
  const isVoz = msg.porVoz;

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 14, alignItems: "flex-end", gap: 8 }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700, flexShrink: 0 }}>IA</div>
      )}
      <div style={{ maxWidth: "78%" }}>
        {isUser && isVoz && (
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4, marginBottom: 3, fontSize: 11, color: "#2d8c5e" }}>
            🎤 Mensaje de voz
          </div>
        )}
        {displayText && (
          <div style={{
            background: isUser ? "#2d8c5e" : "#fff",
            color: isUser ? "#fff" : "#1a1a1a",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            padding: "10px 15px", fontSize: 14, lineHeight: 1.65,
            boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
            border: isUser ? "none" : "1px solid #e8ede9",
            whiteSpace: "pre-wrap",
          }}>{displayText}</div>
        )}
        {cron && <CronologiaCard cron={cron} onConfirmar={onConfirmarCron} />}
        {doc && <DocumentCard doc={doc} onDownload={() => generatePDF(doc)} />}
        {doc && <PanelEnvio doc={doc} />}
      </div>
      {isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#e8f4ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#2d8c5e", fontWeight: 700, flexShrink: 0 }}>Tú</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// AUTH SCREEN
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
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎙</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: "#1a1a1a" }}>Reclamaciones EPS</div>
          <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Etapa 5 — Asistente por Voz</div>
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
// APP PRINCIPAL — ETAPA 5
// ─────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [vozActiva, setVozActiva] = useState(false); // modo voz habilitado
  const [transcripcionParcial, setTranscripcionParcial] = useState("");
  const [procesandoVoz, setProcesandoVoz] = useState(false);
  const [modoRelato, setModoRelato] = useState(false); // narración larga
  const [relatoAcumulado, setRelatoAcumulado] = useState("");
  const [autoSpeak, setAutoSpeak] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const transcriptFinalRef = useRef("");

  const { isListening, isSpeaking, supported, startListening, stopListening, speak, stopSpeaking } =
    useSpeech({
      onTranscript: (text, isFinal) => {
        setTranscripcionParcial(text);
        if (isFinal) { transcriptFinalRef.current = text; }
      },
      onEnd: () => {
        const final = transcriptFinalRef.current;
        transcriptFinalRef.current = "";
        setTranscripcionParcial("");
        if (!final) return;
        if (modoRelato) {
          setRelatoAcumulado(prev => prev + " " + final);
        } else {
          handleVozMessage(final);
        }
      },
    });

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, transcripcionParcial]);

  // Auto-inicio al entrar
  useEffect(() => {
    if (user && messages.length === 0) {
      setTimeout(() => sendMessage("Hola, quiero hacer una reclamación"), 300);
    }
  }, [user]);

  async function handleVozMessage(texto) {
    if (!texto.trim()) return;
    setProcesandoVoz(true);
    await sendMessage(texto, true);
    setProcesandoVoz(false);
  }

  async function procesarRelatoLargo() {
    if (!relatoAcumulado.trim()) return;
    setModoRelato(false);
    setProcesandoVoz(true);

    // Agente de cronología para organizar el relato
    const prompt = AGENTE_CRONOLOGIA_PROMPT.replace("{TRANSCRIPCION}", relatoAcumulado);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await resp.json();
      const texto = data.content?.map(b => b.text || "").join("") || "";
      const userMsg = { role: "user", content: `Narré mi problema por voz:\n\n"${relatoAcumulado}"`, porVoz: true };
      const cronMsg = { role: "assistant", content: texto };
      setMessages(prev => [...prev, userMsg, cronMsg]);
      setRelatoAcumulado("");
    } catch (err) {
      console.error(err);
    } finally { setProcesandoVoz(false); }
  }

  async function confirmarCronologia(cron) {
    const resumen = `Confirmado. EPS: ${cron.eps}. Problema: ${cron.tipo_problema}. Desde cuándo: ${cron.desde_cuando}. Solicitud: ${cron.solicitud_usuario}. Por favor prepara el reclamo completo.`;
    await sendMessage(resumen);
  }

  async function sendMessage(text, porVoz = false) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;
    setLoading(true); setStreamingText("");

    const userMsg = { role: "user", content: trimmed, porVoz };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");

    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 2000,
          system: SYSTEM_PROMPT + (porVoz ? "\n\nNOTA: El usuario está usando voz. Da respuestas cortas y conversacionales." : ""),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
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

      const finalMsg = { role: "assistant", content: full };
      setMessages([...newMessages, finalMsg]);
      setStreamingText("");

      // TTS automático si está en modo voz
      if ((vozActiva || porVoz) && autoSpeak) {
        speak(full);
      }

      // Guardar en Supabase
      try {
        const allMsgs = [...newMessages, finalMsg];
        await supabase.from("reclamos").upsert([{
          user_id: user.id,
          mensajes: allMsgs.slice(-30),
          estado: "en_proceso",
          fecha_creacion: new Date().toISOString(),
        }]);
      } catch {}
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Ocurrió un error. Por favor intenta nuevamente." }]);
    } finally { setLoading(false); setStreamingText(""); }
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

  async function signOut() {
    await supabase.auth.signOut(); setUser(null); setMessages([]);
  }

  if (checkingAuth) return <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f7f5", color: "#888" }}>Cargando...</div>;
  if (!user) return <AuthScreen onAuth={u => setUser(u)} />;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#f5f7f5" }}>
      <style>{`
        @keyframes bounce{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulseRed{0%,100%{box-shadow:0 0 0 0 rgba(192,57,43,0.4)}50%{box-shadow:0 0 0 14px rgba(192,57,43,0)}}
        @keyframes pulseBlue{0%,100%{box-shadow:0 0 0 0 rgba(74,111,165,0.4)}50%{box-shadow:0 0 0 14px rgba(74,111,165,0)}}
        .msg-in{animation:fadeIn 0.25s ease}
        textarea:focus{outline:none}
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e8e2", padding: "11px 16px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff" }}>🎙</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a" }}>Reclamaciones EPS</div>
          <div style={{ fontSize: 11, color: "#2d8c5e" }}>Etapa 5 · Asistente por Voz</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* Toggle voz automática */}
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888", cursor: "pointer" }}>
            <div style={{ position: "relative", width: 32, height: 18 }}>
              <input type="checkbox" checked={autoSpeak} onChange={e => setAutoSpeak(e.target.checked)} style={{ opacity: 0, position: "absolute", inset: 0, margin: 0, cursor: "pointer" }} />
              <div style={{ width: 32, height: 18, borderRadius: 9, background: autoSpeak ? "#2d8c5e" : "#ccc", transition: "background 0.2s" }} />
              <div style={{ position: "absolute", top: 2, left: autoSpeak ? 14 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
            IA habla
          </label>
          {!supported && <span style={{ fontSize: 11, color: "#c0392b" }}>Voz no soportada</span>}
          <button onClick={() => { setMessages([]); setTimeout(() => sendMessage("Hola, quiero hacer una reclamación"), 100); }} style={{ fontSize: 12, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Nueva</button>
          <button onClick={signOut} style={{ fontSize: 12, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>Salir</button>
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          {messages.map((msg, i) => (
            <div key={i} className="msg-in">
              <MessageBubble msg={msg} onDownload={downloadDocument} onConfirmarCron={confirmarCronologia} />
            </div>
          ))}

          {/* Transcripción parcial en tiempo real */}
          {isListening && transcripcionParcial && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }} className="msg-in">
              <div style={{ maxWidth: "78%", display: "flex", alignItems: "flex-end", gap: 8, flexDirection: "row-reverse" }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#e8f4ee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🎤</div>
                <div style={{ background: "rgba(45,140,94,0.1)", border: "1.5px dashed #2d8c5e", borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontSize: 14, color: "#2d4a38", fontStyle: "italic" }}>
                  {transcripcionParcial}
                  <span style={{ display: "inline-block", width: 2, height: 14, background: "#2d8c5e", marginLeft: 4, animation: "bounce 0.8s ease-in-out infinite", verticalAlign: "middle" }} />
                </div>
              </div>
            </div>
          )}

          {/* Modo relato: acumulando */}
          {modoRelato && relatoAcumulado && (
            <div style={{ background: "#f0f9f4", border: "1px solid #c8e6d4", borderRadius: 12, padding: "12px 14px", marginBottom: 12, fontSize: 13, color: "#2d4a38" }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12, color: "#2d8c5e" }}>🎙 NARRACIÓN ACUMULADA</div>
              {relatoAcumulado}
            </div>
          )}

          {(loading || procesandoVoz) && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 14 }} className="msg-in">
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#fff", fontWeight: 700 }}>IA</div>
              <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", border: "1px solid #e8ede9", minWidth: 60 }}>
                {streamingText ? <div style={{ padding: "10px 14px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", maxWidth: 480 }}>{stripBlocks(streamingText)}</div> : <TypingDots />}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Área de controles */}
      <div style={{ background: "#fff", borderTop: "1px solid #e0e8e2", padding: "12px 16px", flexShrink: 0 }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>

          {/* Modo relato largo */}
          {modoRelato && (
            <div style={{ background: "#e8f4ee", border: "1px solid #c8e6d4", borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20 }}>🎙</span>
              <div style={{ flex: 1, fontSize: 13, color: "#2d4a38" }}>
                <strong>Modo narración activado.</strong> Habla todo lo que necesites. Cuando termines, presiona "Finalizar narración".
              </div>
              <button onClick={procesarRelatoLargo} disabled={!relatoAcumulado.trim()} style={{
                background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 8,
                padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                opacity: !relatoAcumulado.trim() ? 0.5 : 1,
              }}>Finalizar narración</button>
              <button onClick={() => { setModoRelato(false); setRelatoAcumulado(""); }} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 18 }}>×</button>
            </div>
          )}

          {/* Controles de voz + texto */}
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            {/* Botón de voz */}
            {supported && (
              <VozButton
                isListening={isListening}
                isSpeaking={isSpeaking}
                onStart={startListening}
                onStop={stopListening}
                onStopSpeaking={stopSpeaking}
                disabled={loading || procesandoVoz}
              />
            )}

            {/* Input de texto */}
            <div style={{ flex: 1 }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder={isListening ? "Escuchando..." : "O escribe aquí... (Enter para enviar)"}
                disabled={isListening}
                rows={1}
                style={{
                  width: "100%", border: "1.5px solid #dde8e0", borderRadius: 12,
                  padding: "10px 14px", fontSize: 14, resize: "none", fontFamily: "system-ui",
                  lineHeight: 1.5, background: isListening ? "#f0f9f4" : "#f9faf9",
                  maxHeight: 100, overflowY: "auto", boxSizing: "border-box",
                  transition: "background 0.2s",
                }}
                onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
              />
            </div>

            {/* Enviar texto */}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading || isListening}
              style={{
                background: input.trim() && !loading && !isListening ? "#2d8c5e" : "#c8ddd3",
                color: "#fff", border: "none", borderRadius: 12,
                width: 42, height: 42, fontSize: 17, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>↑</button>
          </div>

          {/* Acciones extra */}
          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
            {supported && !modoRelato && (
              <button onClick={() => setModoRelato(true)} style={{
                fontSize: 12, color: "#4a6fa5", background: "none",
                border: "1px solid #c8d8f0", borderRadius: 8, padding: "4px 12px", cursor: "pointer",
              }}>
                🎙 Narrar mi caso completo
              </button>
            )}
            {isListening && (
              <span style={{ fontSize: 12, color: "#c0392b", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#c0392b", display: "inline-block", animation: "bounce 0.8s ease-in-out infinite" }} />
                Escuchando... (haz clic en ⏹ para detener)
              </span>
            )}
            {!isListening && !isSpeaking && !loading && (
              <span style={{ fontSize: 11, color: "#aaa" }}>
                {supported ? "🎤 Toca el micrófono para hablar · " : ""}Shift+Enter salto de línea
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
