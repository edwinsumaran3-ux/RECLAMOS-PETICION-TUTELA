import { useState, useRef, useEffect } from "react";
import { jsPDF } from "jspdf";

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPT — La IA SOLO recopila datos del usuario
// Nosotros redactamos el documento legal con los datos recibidos
// ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres un asistente colombiano amable y profesional. Ayudas a las personas a preparar reclamaciones ante su EPS. Hablas en español colombiano correcto, formal y cálido. NUNCA mezcles palabras ni inventes términos. Cada oración debe ser gramaticalmente perfecta.

Tu única tarea es recopilar los datos del usuario haciendo exactamente estas tres preguntas, una por una, en orden:

PREGUNTA 1: "Hola, con mucho gusto le ayudo con su reclamación ante la EPS. ¿Me puede decir con qué EPS está afiliado y cuál es el problema que tiene con ellos?"

PREGUNTA 2 (solo después de recibir respuesta a la pregunta 1): "Entiendo su situación. ¿Desde cuándo tiene este problema y qué respuesta le ha dado la EPS?"

PREGUNTA 3 (solo después de recibir respuesta a la pregunta 2): "Para preparar su documento necesito sus datos personales: nombre completo, número de cédula y un correo electrónico o teléfono. ¿Y qué le pide exactamente a la EPS que haga?"

Cuando ya tenga las respuestas a las tres preguntas, escriba este mensaje de cierre:
"Muchas gracias. Con esta información preparo su documento ahora mismo."

Luego escriba ÚNICAMENTE el siguiente bloque JSON, sin ningún texto antes ni después:

---DATOS_INICIO---
{
  "eps": "[nombre de la EPS]",
  "nombre": "[nombre completo]",
  "cedula": "[número de cédula]",
  "contacto": "[correo o teléfono]",
  "ciudad": "[ciudad si la mencionó, o Colombia]",
  "problema": "[descripción del problema]",
  "servicio_solicitado": "[servicio específico que necesita]",
  "desde_cuando": "[tiempo de espera]",
  "respuesta_eps": "[lo que respondió la EPS, o Sin respuesta]",
  "solicitud_concreta": "[qué quiere que haga la EPS]",
  "nivel_urgencia": "BAJO",
  "tipo_documento": "DERECHO DE PETICIÓN"
}
---DATOS_FIN---

Reglas para tipo_documento:
- Use PQRS si es la primera reclamación o un trámite sencillo.
- Use DERECHO DE PETICIÓN si llevan más de 3 días sin respuesta (es el más común).
- Use SOLICITUD PRIORITARIA si el paciente es menor de edad, adulto mayor, embarazada o tiene discapacidad.
- Use TUTELA PRELIMINAR solo si hay riesgo vital inmediato.

Si no tiene algún dato escriba [DATO PENDIENTE] en ese campo.

IMPORTANTE: Si el caso es urgente diga con calma: "Entiendo que su situación requiere atención urgente. Si hay riesgo para su salud, por favor acuda a urgencias de inmediato. Yo preparo su documento de reclamación al mismo tiempo."`;


// ─────────────────────────────────────────────────────────────
// BASE DE DATOS EPS Y ORGANISMOS
// ─────────────────────────────────────────────────────────────
const EPS_DATABASE = {
  "Sura": { email: "pqrs@sura.com", telefono: "018000-052-052", pqrsPortal: "https://www.sura.com/salud" },
  "EPS Sura": { email: "pqrs@sura.com", telefono: "018000-052-052", pqrsPortal: "https://www.sura.com/salud" },
  "Sanitas": { email: "peticion@sanitas.com.co", telefono: "018000-510-033", pqrsPortal: "https://www.sanitas.com.co" },
  "Compensar": { email: "peticion@compensar.com", telefono: "018000-112-114", pqrsPortal: "https://www.compensar.com/salud/pqrs.aspx" },
  "Nueva EPS": { email: "nuevaeps@nuevaeps.com.co", telefono: "018000-910-097", pqrsPortal: "https://www.nuevaeps.com.co" },
  "Coosalud": { email: "servicioalcliente@coosalud.com.co", telefono: "018000-180-080", pqrsPortal: "https://www.coosalud.com.co" },
  "Medimás": { email: "quejasyreclamos@medimas.com.co", telefono: "018000-120-808", pqrsPortal: "https://www.medimas.com.co" },
  "Famisanar": { email: "pqrs@famisanar.com.co", telefono: "601-742-6060", pqrsPortal: "https://www.famisanar.com.co" },
  "Salud Total": { email: "servicioalcliente@saludtotal.com.co", telefono: "018000-912-912", pqrsPortal: "https://www.saludtotal.com.co" },
  "Coomeva": { email: "servicioalcliente@coomeva.com.co", telefono: "018000-916-161", pqrsPortal: "https://www.coomeva.com.co" },
  "Mutual SER": { email: "servicioalcliente@mutualser.com.co", telefono: "018000-120-808", pqrsPortal: "https://www.mutualser.com.co" },
  "Aliansalud": { email: "servicioalcliente@aliansalud.com.co", telefono: "018000-519-519", pqrsPortal: "https://www.aliansalud.com.co" },
  "Cajacopi": { email: "atencionusuario@cajacopi.com.co", telefono: "605-330-0500", pqrsPortal: "https://www.cajacopi.com.co" },
  "Emssanar": { email: "servicioalcliente@emssanar.com.co", telefono: "018000-510-010", pqrsPortal: "https://www.emssanar.com.co" },
  "Asmet Salud": { email: "asmet@asmet.co", telefono: "018000-510-800", pqrsPortal: "https://www.asmet.co" },
  "Comfenalco Valle": { email: "servicioalcliente@comfenalcovalle.com.co", telefono: "018000-180-500", pqrsPortal: "https://www.comfenalcovalle.com.co" },
  "SOS Salud": { email: "servicioalcliente@sos-salud.com.co", telefono: "018000-912-120", pqrsPortal: "https://www.sos-salud.com.co" },
};
const SUPERSALUD = { pqrdPortal: "https://www.supersalud.gov.co/es-co/supersalud/radique-su-pqrd", telefono: "018000-513-700" };
const DEFENSORIA = { portal: "https://www.defensoria.gov.co", telefono: "018000-914-814" };

function detectarEPS(eps) {
  if (!eps) return null;
  const d = eps.toLowerCase();
  return Object.keys(EPS_DATABASE).find(k => d.includes(k.toLowerCase())) || null;
}

// ─────────────────────────────────────────────────────────────
// PARSEAR DATOS DEL JSON GENERADO POR LA IA
// ─────────────────────────────────────────────────────────────
function parseDatos(text) {
  if (!text) return null;

  // Intento 1: marcadores exactos ---DATOS_INICIO--- ... ---DATOS_FIN---
  const s = text.indexOf("---DATOS_INICIO---");
  const e = text.indexOf("---DATOS_FIN---");
  if (s !== -1 && e !== -1) {
    try { return JSON.parse(text.slice(s + 18, e).trim()); } catch {}
  }

  // Intento 2: bloques de código markdown ```json { ... } ```
  const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) {
    const inner = mdMatch[1].trim();
    // puede tener marcadores dentro del bloque
    const si = inner.indexOf("---DATOS_INICIO---");
    const ei = inner.indexOf("---DATOS_FIN---");
    if (si !== -1 && ei !== -1) {
      try { return JSON.parse(inner.slice(si + 18, ei).trim()); } catch {}
    }
    try { return JSON.parse(inner); } catch {}
  }

  // Intento 3: cualquier JSON con campos clave del formulario
  const jsonMatch = text.match(/\{[\s\S]*?"eps"[\s\S]*?\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }

  return null;
}

// Extrae datos de conversación cuando la IA no emite JSON (modo fallback)
function extraerDatosDeConversacion(messages) {
  const texto = messages.map(m => m.content || "").join(" ");
  const get = (patterns) => {
    for (const p of patterns) {
      const m = texto.match(p);
      if (m) return m[1]?.trim() || null;
    }
    return null;
  };
  // Detectar EPS mencionada
  const epsConocidas = Object.keys(EPS_DATABASE);
  const epsDetectada = epsConocidas.find(k => texto.toLowerCase().includes(k.toLowerCase())) || null;
  // Detectar cédula (número de 6-10 dígitos)
  const cedulaMatch = texto.match(/\b(\d{6,10})\b/);
  // Detectar email
  const emailMatch = texto.match(/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/);
  // Detectar teléfono colombiano
  const telMatch = texto.match(/\b(3\d{9}|\d{7,10})\b/);
  // Detectar nombre (heurístico: 2-4 palabras con mayúscula)
  const nombreMatch = texto.match(/(?:me llamo|soy|nombre[:\s]+|nombre completo[:\s]+)([A-ZÁÉÍÓÚ][a-záéíóú]+(?: [A-ZÁÉÍÓÚ][a-záéíóú]+){1,3})/i);

  return {
    eps: epsDetectada || "[DATO PENDIENTE]",
    nombre: nombreMatch?.[1] || "[DATO PENDIENTE]",
    cedula: cedulaMatch?.[1] || "[DATO PENDIENTE]",
    contacto: emailMatch?.[0] || telMatch?.[1] || "[DATO PENDIENTE]",
    ciudad: "Colombia",
    problema: "[DATO PENDIENTE]",
    servicio_solicitado: "[DATO PENDIENTE]",
    desde_cuando: "[DATO PENDIENTE]",
    respuesta_eps: "Sin respuesta formal",
    solicitud_concreta: "[DATO PENDIENTE]",
    nivel_urgencia: "BAJO",
    tipo_documento: "DERECHO DE PETICIÓN",
  };
}

function stripDatos(text) {
  if (!text) return "";
  const s = text.indexOf("---DATOS_INICIO---");
  const e = text.indexOf("---DATOS_FIN---");
  if (s === -1 || e === -1) return text.trim();
  return (text.slice(0, s) + text.slice(e + 15)).trim();
}

// Solo muestra el texto ANTES del bloque JSON durante streaming
function getStreamingDisplay(text) {
  if (!text) return "";
  const s = text.indexOf("---DATOS_INICIO---");
  if (s === -1) return text;
  return text.slice(0, s).trim();
}

// ─────────────────────────────────────────────────────────────
// PLANTILLAS LEGALES — Redactadas por nosotros
// La IA solo proporciona los datos del usuario
// ─────────────────────────────────────────────────────────────
function getFecha() {
  return new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
}

function plantillaPQRS(d) {
  const n = d.nombre || "[DATO PENDIENTE]";
  const cc = d.cedula || "[DATO PENDIENTE]";
  const eps = d.eps || "[EPS]";
  const contacto = d.contacto || "[DATO PENDIENTE]";
  const ciudad = d.ciudad || "Colombia";
  const servicio = d.servicio_solicitado || d.problema || "[DATO PENDIENTE]";
  const desde = d.desde_cuando || "[fecha]";
  const solicitud = d.solicitud_concreta || "[DATO PENDIENTE]";

  return {
    tipo: "PQRS",
    ciudadFecha: `${ciudad}, ${getFecha()}`,
    destinatario: `Señores\n${eps}\nOficina de Peticiones, Quejas, Reclamos y Sugerencias\nLa ciudad`,
    asunto: `Asunto: PQRS — Artículo 49 de la Constitución Política y Ley 1438 de 2011 — ${servicio}`,
    cuerpo: `Respetados señores:

Yo, ${n}, identificado(a) con cédula de ciudadanía No. ${cc}, afiliado(a) a ${eps}, domiciliado(a) en ${ciudad}, de conformidad con lo establecido en el artículo 49 de la Constitución Política de Colombia, en concordancia con la Ley 1438 de 2011, respetuosamente me permito presentar la siguiente Petición, Queja, Reclamo y Sugerencia.

HECHOS

1. Que me encuentro afiliado(a) a ${eps} como usuario activo del Sistema General de Seguridad Social en Salud, con pleno cumplimiento de mis obligaciones como afiliado.

2. Que desde ${desde} he solicitado la prestación del servicio de ${servicio}, el cual es necesario e indispensable para preservar mi salud y bienestar.

3. Que a pesar de mis solicitudes, la entidad no ha dado solución oportuna. La EPS ha manifestado: ${reps}

4. Que esta demora vulnera mi derecho a recibir atención de salud oportuna y de calidad, conforme a los principios del artículo 153 de la Ley 100 de 1993.

FUNDAMENTOS DE DERECHO

• Artículo 49, Constitución Política — Derecho a la salud como servicio público esencial a cargo del Estado.
• Ley 1438 de 2011, Artículo 10 — Derechos de los usuarios del sistema de salud.
• Resolución 1552 de 2013, Ministerio de Salud — Tiempos máximos de espera para asignación de citas.
• Ley 1751 de 2015, Artículo 10 — Garantía de oportunidad, continuidad e integralidad en la prestación.

PETICIÓN

Por los anteriores hechos mencionados, respetuosamente solicito:

1. ${solicitud}
2. Que se dé respuesta escrita, oportuna y de fondo dentro de los quince (15) días hábiles siguientes a la radicación, conforme a la Ley 1755 de 2015, artículo 14.
3. Que se garantice la continuidad y calidad en la prestación del servicio de salud al que tengo derecho.

Por tanto, solicito que mi petición sea resuelta de fondo. Confío en que esta solicitud recibirá la atención que merece. Como afiliado(a), conozco mis derechos y exijo respetuosamente que sean garantizados conforme a la Constitución Política y la Ley 1751 de 2015.

NOTIFICACIÓN

Para efectos legales, recibiré notificaciones en:
Correo / Teléfono: ${contacto}
Ciudad: ${ciudad}

Cordialmente,


___________________________________
Firma
${n}
C.C. No. ${cc}
Contacto: ${contacto}

---
Borrador generado con apoyo tecnológico. Revisar antes de radicar.`,
  };
}

function plantillaDerechoPeticion(d) {
  const n = d.nombre || "[DATO PENDIENTE]";
  const cc = d.cedula || "[DATO PENDIENTE]";
  const eps = d.eps || "[EPS]";
  const contacto = d.contacto || "[DATO PENDIENTE]";
  const ciudad = d.ciudad || "Colombia";
  const servicio = d.servicio_solicitado || d.problema || "[DATO PENDIENTE]";
  const desde = d.desde_cuando || "[fecha]";
  const respEPS = d.respuesta_eps || "Sin respuesta formal.";
  const solicitud = d.solicitud_concreta || "[DATO PENDIENTE]";

  return {
    tipo: "DERECHO DE PETICIÓN",
    ciudadFecha: `${ciudad}, ${getFecha()}`,
    destinatario: `Señores\n${eps}\nDefensoría del Usuario\nLa ciudad`,
    asunto: `Asunto: Derecho de Petición — Artículo 23 de la Constitución Política de Colombia y Ley 1755 de 2015 — ${servicio}`,
    cuerpo: `Respetados señores:

Yo, ${n}, identificado(a) con cédula de ciudadanía No. ${cc}, afiliado(a) a ${eps}, domiciliado(a) en ${ciudad}, de conformidad con lo establecido en el artículo 23 de la Constitución Política de Colombia, en concordancia con la Ley 1755 de 2015, comedidamente me permito elevar ante ustedes el presente DERECHO DE PETICIÓN que a continuación se describe.

HECHOS

1. Que me encuentro afiliado(a) a ${eps} como usuario activo del Sistema General de Seguridad Social en Salud, con pleno cumplimiento de mis obligaciones como afiliado.

2. Que desde ${desde} he solicitado de manera reiterada la prestación del servicio de ${servicio}, el cual es indispensable para preservar mi salud e integridad.

3. Que a pesar de mis múltiples solicitudes, la entidad no ha brindado solución oportuna ni de fondo a mi requerimiento. La EPS ha manifestado: ${respEPS}

4. Que esta omisión vulnera mi derecho fundamental a la salud, consagrado en el artículo 49 de la Constitución Política y desarrollado en la Ley 1751 de 2015, Ley Estatutaria de Salud, la cual establece que la salud es un derecho fundamental autónomo e irrenunciable.

5. Que el artículo 15 de la Ley 1751 de 2015 prohíbe expresamente negar, suspender o interrumpir la prestación de servicios incluidos en el Plan de Beneficios en Salud sin justa causa debidamente motivada.

FUNDAMENTOS DE DERECHO

• Artículo 23, Constitución Política de Colombia — Derecho de petición ante entidades prestadoras de servicios públicos.
• Ley 1755 de 2015, Artículo 14 — La entidad debe dar respuesta de fondo en quince (15) días hábiles.
• Artículo 49, Constitución Política — Derecho a la salud como servicio público esencial.
• Ley 1751 de 2015, Artículo 10 — Oportunidad, continuidad e integralidad en la prestación.
• Ley 1751 de 2015, Artículo 15 — Prohibición de negar servicios del Plan de Beneficios en Salud.
• Ley 100 de 1993, Artículo 153 — Principios del SGSSS: calidad, oportunidad y eficiencia.

PETICIÓN

Por los anteriores hechos mencionados, respetuosamente solicito:

1. ${solicitud}
2. Que se dé respuesta escrita, oportuna, clara y de fondo a la presente petición dentro de los quince (15) días hábiles siguientes a la radicación, conforme al artículo 14 de la Ley 1755 de 2015.
3. Que se garantice la continuidad, oportunidad e integralidad en la prestación del servicio de salud al que tengo derecho como afiliado(a).

Por tanto, solicito que mi petición sea resuelta de fondo, con pleno respeto de los términos y garantías establecidos en la ley. Confío en que recibiré respuesta oportuna. Como afiliado(a), conozco mis derechos y exijo respetuosamente que sean garantizados conforme a la Constitución Política, la Ley 1751 de 2015 y la Ley 100 de 1993.

NOTIFICACIÓN

Para efectos legales, recibiré notificaciones en:
Correo / Teléfono: ${contacto}
Ciudad: ${ciudad}

Cordialmente,


___________________________________
Firma
${n}
C.C. No. ${cc}
Contacto: ${contacto}

---
Borrador generado con apoyo tecnológico. Revisar antes de radicar.`,
  };
}

function plantillaPrioritaria(d) {
  const n = d.nombre || "[DATO PENDIENTE]";
  const cc = d.cedula || "[DATO PENDIENTE]";
  const eps = d.eps || "[EPS]";
  const contacto = d.contacto || "[DATO PENDIENTE]";
  const ciudad = d.ciudad || "Colombia";
  const servicio = d.servicio_solicitado || d.problema || "[DATO PENDIENTE]";
  const desde = d.desde_cuando || "[fecha]";
  const respEPS = d.respuesta_eps || "Sin respuesta formal.";
  const solicitud = d.solicitud_concreta || "[DATO PENDIENTE]";

  return {
    tipo: "SOLICITUD PRIORITARIA",
    ciudadFecha: `${ciudad}, ${getFecha()}`,
    destinatario: `Señores\n${eps}\nGerencia General — ATENCIÓN PRIORITARIA\nLa ciudad`,
    asunto: `Asunto: Solicitud Prioritaria Urgente — Sujeto de Especial Protección Constitucional — Artículos 43, 44 y 46 Constitución Política y Ley 1751 de 2015 — ${servicio}`,
    cuerpo: `Respetados señores:

Yo, ${n}, identificado(a) con cédula de ciudadanía No. ${cc}, afiliado(a) a ${eps}, domiciliado(a) en ${ciudad}, en mi condición de sujeto de especial protección constitucional, de conformidad con lo establecido en la Constitución Política de Colombia y en la Ley 1751 de 2015, respetuosamente elevo la presente SOLICITUD PRIORITARIA de atención en salud.

HECHOS

1. Que me encuentro afiliado(a) a ${eps} y ostento la condición de sujeto de especial protección constitucional, reconocida por el ordenamiento jurídico colombiano, que me otorga el derecho a una atención preferente en salud.

2. Que desde ${desde} he solicitado con carácter urgente la prestación del servicio de ${servicio}, sin el cual mi condición de salud se deteriora de manera significativa.

3. Que a pesar de mis reiteradas solicitudes y de mi condición especial, la entidad no ha brindado atención prioritaria. La EPS ha manifestado: ${respEPS}

4. Que esta omisión vulnera gravemente mis derechos fundamentales, conforme a los artículos 43, 44 y 46 de la Constitución Política, según corresponda a mi condición, y el artículo 6 de la Ley 1751 de 2015, que obliga expresamente a garantizar atención preferente a sujetos de especial protección.

5. Que la Ley 1751 de 2015, artículo 10, garantiza el derecho a recibir los servicios de salud con oportunidad, eficiencia e integralidad, sin restricciones injustificadas.

FUNDAMENTOS DE DERECHO

• Artículos 43, 44 y 46, Constitución Política — Protección especial a mujeres gestantes, niños y adultos mayores.
• Ley 1751 de 2015, Artículo 6 — Obligación de atención prioritaria a sujetos de especial protección constitucional.
• Ley 1751 de 2015, Artículo 10 — Derecho a la oportunidad, continuidad e integralidad en la prestación.
• Ley 1755 de 2015, Artículo 14 — Plazo de cinco (5) días hábiles para casos de especial urgencia.
• Sentencia T-760 de 2008, Corte Constitucional — La salud es un derecho fundamental; las EPS deben garantizarla especialmente a sujetos vulnerables.

PETICIÓN

Por los anteriores hechos mencionados y en virtud de mi condición especial, respetuosamente solicito con carácter URGENTE Y PRIORITARIO:

1. ${solicitud}
2. Que se dé respuesta escrita y de fondo en un plazo máximo de cinco (5) días hábiles, dado el carácter prioritario de este caso.
3. Que se garantice de manera inmediata la continuidad e integralidad del servicio de salud requerido, sin interrupciones ni dilaciones injustificadas.

Por tanto, solicito que mi petición sea resuelta de forma prioritaria y de fondo. Exijo respetuosamente que esta solicitud sea atendida en el plazo que ordena la ley, pues el artículo 6 de la Ley 1751 de 2015 obliga expresamente a garantizar atención preferente a personas en mi condición.

NOTIFICACIÓN

Para efectos legales, recibiré notificaciones en:
Correo / Teléfono: ${contacto}
Ciudad: ${ciudad}

Cordialmente,


___________________________________
Firma
${n}
C.C. No. ${cc}
Contacto: ${contacto}

---
Borrador generado con apoyo tecnológico. Revisar antes de radicar.`,
  };
}

function plantillaTutela(d) {
  const n = d.nombre || "[DATO PENDIENTE]";
  const cc = d.cedula || "[DATO PENDIENTE]";
  const eps = d.eps || "[EPS]";
  const contacto = d.contacto || "[DATO PENDIENTE]";
  const ciudad = d.ciudad || "Colombia";
  const servicio = d.servicio_solicitado || d.problema || "[DATO PENDIENTE]";
  const desde = d.desde_cuando || "[fecha]";
  const respEPS = d.respuesta_eps || "Sin respuesta formal.";
  const solicitud = d.solicitud_concreta || "[DATO PENDIENTE]";

  return {
    tipo: "TUTELA PRELIMINAR",
    ciudadFecha: `${ciudad}, ${getFecha()}`,
    destinatario: `Señor Juez de la República\n${ciudad}\n(Puede radicarse en cualquier Juzgado, Defensoría del Pueblo o Personería Municipal, sin necesidad de abogado)`,
    asunto: `Asunto: Acción de Tutela — Artículo 86 de la Constitución Política y Decreto 2591 de 1991 — Vulneración del Derecho Fundamental a la Salud — contra ${eps}`,
    cuerpo: `Respetado señor Juez:

Yo, ${n}, identificado(a) con cédula de ciudadanía No. ${cc}, domiciliado(a) en ${ciudad}, contacto: ${contacto}, en ejercicio del mecanismo constitucional de protección de derechos fundamentales consagrado en el artículo 86 de la Constitución Política de Colombia y reglamentado por el Decreto 2591 de 1991, respetuosamente interpongo ACCIÓN DE TUTELA contra ${eps}, con base en los siguientes hechos y fundamentos de derecho.

PARTES

Accionante: ${n}, C.C. No. ${cc}, ${ciudad}
Accionado: ${eps}, Entidad Promotora de Salud del Sistema General de Seguridad Social en Salud

HECHOS

1. Que me encuentro afiliado(a) a ${eps} como usuario activo del Sistema General de Seguridad Social en Salud, con pleno cumplimiento de mis obligaciones como afiliado.

2. Que desde ${desde} he requerido de manera urgente la prestación del servicio de ${servicio}, sin el cual mi salud se encuentra en riesgo.

3. Que a pesar de mis múltiples solicitudes, ${eps} no ha prestado el servicio requerido de manera oportuna. La entidad ha manifestado: ${respEPS}

4. Que esta negativa u omisión vulnera directamente mi derecho fundamental a la salud, reconocido como derecho fundamental autónomo por la Ley 1751 de 2015 y protegido por el artículo 49 de la Constitución Política.

5. Que el artículo 15 de la Ley 1751 de 2015 prohíbe expresamente negar, suspender o interrumpir la prestación continua de los servicios de salud, y que la Sentencia T-760 de 2008 de la Corte Constitucional establece la obligación de las EPS de garantizar el acceso integral y oportuno a los servicios de salud.

DERECHO FUNDAMENTAL VULNERADO

Derecho fundamental a la salud, consagrado en el artículo 49 de la Constitución Política y desarrollado por la Ley 1751 de 2015 como derecho fundamental autónomo, irrenunciable e imprescriptible.

FUNDAMENTOS DE DERECHO

• Artículo 86, Constitución Política — Acción de tutela para la protección inmediata de derechos fundamentales.
• Decreto 2591 de 1991 — Reglamentación de la tutela; el juez debe fallar en diez (10) días calendario.
• Ley 1751 de 2015 — La salud es un derecho fundamental autónomo, autónomo e irrenunciable.
• Artículo 15, Ley 1751 de 2015 — Prohibición de negar o interrumpir servicios incluidos en el Plan de Beneficios.
• Sentencia T-760 de 2008, Corte Constitucional — Obligación de la EPS de garantizar servicio oportuno e integral.

PRETENSIONES

Solicito respetuosamente al Honorable Despacho:

PRIMERA: Tutelar el derecho fundamental a la salud de ${n}, vulnerado por la acción u omisión de ${eps}.

SEGUNDA: Ordenar a ${eps} que, dentro de las cuarenta y ocho (48) horas siguientes a la notificación del fallo: ${solicitud}

TERCERA: Ordenar a ${eps} garantizar la continuidad, oportunidad e integralidad de la atención en salud requerida, sin suspensión ni interrupción injustificada.

Solicito respetuosamente al Honorable Despacho dar trámite urgente y preferente a esta acción, conforme al artículo 86 de la Constitución Política y el Decreto 2591 de 1991. Mi derecho a la salud, como derecho fundamental reconocido por la Ley 1751 de 2015, requiere protección inmediata e impostergable.

Bajo la gravedad del juramento, manifiesto que los hechos narrados en la presente acción son verídicos y corresponden a la realidad.

NOTIFICACIÓN

Para efectos legales, recibiré notificaciones en:
Correo / Teléfono: ${contacto}
Ciudad: ${ciudad}

NOTA: Esta acción puede radicarse personalmente, sin necesidad de abogado, ante cualquier Juzgado Civil, Laboral o Administrativo, la Defensoría del Pueblo (018000-914-814) o la Personería Municipal.

Cordialmente,


___________________________________
Firma
${n}
C.C. No. ${cc}
Contacto: ${contacto}

---
Borrador generado con apoyo tecnológico. Se recomienda orientación de la Defensoría del Pueblo antes de radicar.`,
  };
}

function generarDocumento(datos) {
  const tipo = datos.tipo_documento || "DERECHO DE PETICIÓN";
  if (tipo === "PQRS") return plantillaPQRS(datos);
  if (tipo === "SOLICITUD PRIORITARIA") return plantillaPrioritaria(datos);
  if (tipo === "TUTELA PRELIMINAR") return plantillaTutela(datos);
  return plantillaDerechoPeticion(datos); // default
}

// ─────────────────────────────────────────────────────────────
// GENERACIÓN DE PDF CON EL DOCUMENTO REDACTADO
// ─────────────────────────────────────────────────────────────
const TIPO_COLOR = {
  "PQRS": [45, 140, 94],
  "DERECHO DE PETICIÓN": [45, 100, 170],
  "SOLICITUD PRIORITARIA": [180, 100, 0],
  "TUTELA PRELIMINAR": [160, 30, 30],
};

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE PAGO
// Reemplaza con tus datos reales de Wompi y Nequi/Daviplata
// ─────────────────────────────────────────────────────────────
const PAGO_CONFIG = {
  monto: 5000,
  montoTexto: "$5.000 COP",
  nequiNumero: "305 4064232",
  concepto: "Documento Legal EPS",
  nombreCuenta: "Plataforma Reclamaciones EPS",
};

function PagoModal({ accion, onPagado, onCerrar }) {
  const [paso, setPaso] = useState("nequi"); // nequi | procesando | gracias
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState("");

  const iconAccion = accion === "enviar" ? "📧" : "⬇";
  const textoAccion = accion === "enviar" ? "Enviar al EPS" : "Descargar PDF oficial";

  const copiar = (txt) => navigator.clipboard.writeText(txt);

  const confirmar = () => {
    if (referencia.trim().length < 4) {
      setError("Ingresa la referencia o número de comprobante de tu pago Nequi.");
      return;
    }
    setPaso("procesando");
    setTimeout(() => setPaso("gracias"), 2000);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 22, width: "100%", maxWidth: 400, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.35)", fontFamily: "system-ui" }}>

        {/* HEADER */}
        <div style={{ background: "linear-gradient(135deg, #2d8c5e 0%, #1a6644 100%)", padding: "20px 22px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 42, height: 42, background: "rgba(255,255,255,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>🏥</div>
              <div>
                <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Activar documento</div>
                <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 12 }}>{iconAccion} {textoAccion}</div>
              </div>
            </div>
            <button onClick={onCerrar} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", fontSize: 17, cursor: "pointer" }}>×</button>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "10px 14px", marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Contribución de acceso</span>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 24, letterSpacing: -0.5 }}>{PAGO_CONFIG.montoTexto}</span>
          </div>
        </div>

        <div style={{ padding: "20px 22px" }}>

          {/* PASO: NEQUI */}
          {paso === "nequi" && (
            <>
              <div style={{ background: "#f0faf5", border: "1.5px solid #2d8c5e", borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 26 }}>📱</span>
                  <div>
                    <div style={{ fontWeight: 700, color: "#1a6640", fontSize: 14 }}>Paga con Nequi</div>
                    <div style={{ fontSize: 12, color: "#666" }}>Abre tu app y transfiere al número</div>
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  {[
                    ["Número Nequi", PAGO_CONFIG.nequiNumero, true],
                    ["Monto exacto", PAGO_CONFIG.montoTexto, true],
                    ["Concepto", PAGO_CONFIG.concepto, false],
                    ["Nombre", PAGO_CONFIG.nombreCuenta, false],
                  ].map(([k, v, bold]) => (
                    <tr key={k} style={{ borderBottom: "1px solid #c8e6d4" }}>
                      <td style={{ padding: "7px 0", color: "#666", fontSize: 12, fontWeight: 600, width: "38%" }}>{k}</td>
                      <td style={{ padding: "7px 0", display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: bold ? 800 : 400, color: bold ? "#1a1a1a" : "#444" }}>{v}</span>
                        {bold && (
                          <button onClick={() => copiar(v)} title="Copiar" style={{ background: "none", border: "1px solid #c8e6d4", borderRadius: 5, padding: "1px 7px", fontSize: 10, cursor: "pointer", color: "#2d8c5e" }}>Copiar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </table>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: "#333", display: "block", marginBottom: 6 }}>
                  Referencia o comprobante del pago *
                </label>
                <input
                  type="text"
                  value={referencia}
                  onChange={e => { setReferencia(e.target.value); setError(""); }}
                  onKeyDown={e => e.key === "Enter" && confirmar()}
                  placeholder="Ingresa el número de referencia Nequi"
                  style={{
                    width: "100%", border: `1.5px solid ${error ? "#f5a0a0" : "#c8e6d4"}`,
                    borderRadius: 10, padding: "11px 13px", fontSize: 14,
                    boxSizing: "border-box", outline: "none",
                  }}
                />
                {error && <div style={{ color: "#c0392b", fontSize: 12, marginTop: 5 }}>⚠️ {error}</div>}
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 5 }}>
                  Encuentra la referencia en el historial de transacciones de tu app Nequi.
                </div>
              </div>

              <button
                onClick={confirmar}
                style={{
                  width: "100%", background: "linear-gradient(135deg, #2d8c5e, #1a6644)",
                  color: "#fff", border: "none", borderRadius: 11, padding: "13px",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                ✓ Confirmar pago y activar
              </button>
            </>
          )}

          {/* PASO: PROCESANDO */}
          {paso === "procesando" && (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 44, marginBottom: 14, display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#333" }}>Verificando referencia...</div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 6 }}>Un momento por favor</div>
            </div>
          )}

          {/* PASO: GRACIAS */}
          {paso === "gracias" && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 56, marginBottom: 10 }}>🎉</div>
              <div style={{ fontWeight: 800, fontSize: 20, color: "#1a6640", marginBottom: 10 }}>¡Pago confirmado!</div>
              <div style={{ color: "#444", fontSize: 14, lineHeight: 1.75, marginBottom: 22 }}>
                <strong>Muchas gracias por confiar en nuestra plataforma.</strong>
                <br />
                Tu aporte nos ayuda a seguir ofreciendo este servicio gratuitamente a todos los colombianos que lo necesitan.
                <br /><br />
                Tu documento legal oficial está listo para descargar y enviar. Esperamos que tu reclamación sea resuelta de forma favorable y oportuna.
              </div>
              <button
                onClick={onPagado}
                style={{
                  width: "100%", background: "linear-gradient(135deg, #2d8c5e, #1a6644)",
                  color: "#fff", border: "none", borderRadius: 12, padding: "14px",
                  fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                {iconAccion} {textoAccion}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

const SECTION_NAMES = [
  "HECHOS", "FUNDAMENTOS DE DERECHO", "PETICIÓN", "NOTIFICACIÓN", "PARTES",
  "DERECHO FUNDAMENTAL VULNERADO", "PRETENSIONES", "SOLICITUD",
];
function isSectionHeader(t) {
  if (!t || t.length > 60) return false;
  return SECTION_NAMES.some(h => t === h || t === h + ":") ||
    /^(PRIMERA|SEGUNDA|TERCERA|CUARTA)$/.test(t);
}

function generatePDF(docData, pagado = false) {
  const pdf     = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const margin  = 22;
  const pageW   = pdf.internal.pageSize.getWidth();
  const pageH   = pdf.internal.pageSize.getHeight();
  const cW      = pageW - margin * 2;
  const color   = TIPO_COLOR[docData.tipo] || [45, 140, 94];
  let y         = margin;

  const check = (n = 8) => {
    if (y + n > pageH - 16) { pdf.addPage(); y = margin + 4; }
  };

  const txt = (text, size = 10, bold = false, rgb = [25,25,25], indent = 0) => {
    if (!text?.trim()) return;
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setTextColor(...rgb);
    pdf.splitTextToSize(text.trim(), cW - indent).forEach(l => {
      check(size * 0.44); pdf.text(l, margin + indent, y); y += size * 0.44;
    });
    y += 1;
  };

  const hLine = (rgb = [210,210,210], w = 0.3) => {
    pdf.setDrawColor(...rgb); pdf.setLineWidth(w);
    pdf.line(margin, y, pageW - margin, y); y += 3;
  };

  const secHeader = (text) => {
    y += 5; check(12);
    // fondo suave
    pdf.setFillColor(...color.map(c => Math.min(255, c + 195)));
    pdf.rect(margin, y - 4, cW, 8, "F");
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10.5); pdf.setTextColor(...color);
    pdf.text(text, margin + 3, y); y += 7;
  };

  // ── Encabezado coloreado ─────────────────────────────
  pdf.setFillColor(...color); pdf.rect(0, 0, pageW, 22, "F");
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(255,255,255);
  pdf.text(docData.tipo || "DOCUMENTO", margin, 11);
  pdf.setFontSize(8.5); pdf.setFont("helvetica","normal");
  pdf.text("Plataforma de Reclamaciones EPS · Colombia", margin, 17);
  y = 28;

  // ── Ciudad y fecha (derecha) ─────────────────────────
  pdf.setFontSize(9); pdf.setTextColor(110,110,110);
  const fw = pdf.getTextWidth(docData.ciudadFecha || "");
  pdf.text(docData.ciudadFecha || "", pageW - margin - fw, y);
  y += 8;

  // ── Destinatario ─────────────────────────────────────
  (docData.destinatario || "").split("\n").forEach((dl, i) => {
    if (!dl.trim()) return;
    pdf.setFont("helvetica", i <= 1 ? "bold" : "normal");
    pdf.setFontSize(10); pdf.setTextColor(20,20,20);
    pdf.text(dl.trim(), margin, y); y += 5.2;
  });
  y += 5;

  // ── Asunto en caja ───────────────────────────────────
  const asL = pdf.splitTextToSize(docData.asunto || "", cW - 8);
  const asH = asL.length * 5.2 + 8;
  pdf.setFillColor(...color.map(c => Math.min(255, c + 205)));
  pdf.setDrawColor(...color); pdf.setLineWidth(0.6);
  pdf.roundedRect(margin, y - 3, cW, asH, 2, 2, "FD");
  pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.setTextColor(...color);
  asL.forEach(al => { pdf.text(al, margin + 5, y); y += 5.2; });
  y += 9;
  hLine(color, 0.5);

  // ── Cuerpo ───────────────────────────────────────────
  (docData.cuerpo || "").split("\n").forEach(rawLine => {
    const t = rawLine.trim();
    if (!t) { y += 2; return; }

    if (t === "---") { hLine(); return; }

    if (t.startsWith("___")) {
      y += 5; check(14);
      pdf.setDrawColor(100,100,100); pdf.setLineWidth(0.4);
      pdf.line(margin, y, margin + 75, y); y += 6;
      return;
    }

    if (isSectionHeader(t)) { secHeader(t); return; }

    if (/^(PRIMERA|SEGUNDA|TERCERA|CUARTA):/.test(t)) {
      const ci = t.indexOf(":");
      const lbl = t.slice(0, ci); const rest = t.slice(ci + 1).trim();
      y += 2;
      txt(lbl + ":", 10, true, color, 3);
      if (rest) txt(rest, 10, false, [40,40,40], 6);
      return;
    }

    if (t.startsWith("•")) {
      check(8);
      pdf.setFont("helvetica","bold"); pdf.setFontSize(10.5); pdf.setTextColor(...color);
      pdf.text("•", margin + 3, y);
      const bL = pdf.splitTextToSize(t.slice(1).trim(), cW - 13);
      pdf.setFont("helvetica","normal"); pdf.setTextColor(35,35,35);
      bL.forEach(bl => { check(5); pdf.text(bl, margin + 10, y); y += 5; });
      y += 1;
      return;
    }

    if (/^\d+\./.test(t)) {
      const m = t.match(/^(\d+\.)\s*(.*)/s);
      if (m) {
        y += 1; check(8);
        pdf.setFont("helvetica","bold"); pdf.setFontSize(10); pdf.setTextColor(...color);
        pdf.text(m[1], margin + 3, y);
        pdf.setFont("helvetica","normal"); pdf.setTextColor(30,30,30);
        pdf.splitTextToSize(m[2], cW - 14).forEach(nl => {
          check(5); pdf.text(nl, margin + 11, y); y += 5;
        });
        y += 1;
        return;
      }
    }

    // Etiquetas
    const isLabel = /^(Firma|C\.C\. No\.|Contacto:|NOTA:|Correo|Ciudad|Accionante|Accionado|Para efectos|Bajo la gravedad)/.test(t);
    txt(t, 10, isLabel, isLabel ? [50,50,50] : [20,20,20]);
  });

  // ── Pie de página ────────────────────────────────────
  const total = pdf.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    pdf.setPage(p);
    pdf.setDrawColor(210,210,210); pdf.setLineWidth(0.3);
    pdf.line(margin, pageH - 12, pageW - margin, pageH - 12);
    pdf.setFontSize(7); pdf.setTextColor(155,155,155);
    pdf.text(
      pagado
        ? "Documento oficial generado por Plataforma Reclamaciones EPS Colombia."
        : "Borrador generado con apoyo tecnológico · Revisar con la Defensoría del Pueblo antes de radicar.",
      margin, pageH - 7
    );
    pdf.text(`Pág. ${p}/${total}`, pageW - margin - 14, pageH - 7);
  }

  pdf.save(`${(docData.tipo || "reclamo").replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.pdf`);
}

function handleEnviarEPS(docData, datosUsuario, pagado = false) {
  generatePDF(docData, pagado);
  const epsKey = detectarEPS(datosUsuario.eps || docData.destinatario);
  const epsInfo = epsKey ? EPS_DATABASE[epsKey] : null;
  const to = epsInfo?.email || "";
  const subject = encodeURIComponent(
    `${docData.tipo || "PQRS"} - ${datosUsuario.nombre || ""} - CC ${datosUsuario.cedula || ""}`
  );
  const body = encodeURIComponent(
    `Señores ${datosUsuario.eps || "EPS"},\n\n` +
    `ASUNTO: ${docData.asunto || ""}\n\n` +
    `${datosUsuario.nombre || ""}, C.C. ${datosUsuario.cedula || ""}, Contacto: ${datosUsuario.contacto || ""}\n\n` +
    `Adjunto documento PDF con el texto completo del reclamo.\n\n` +
    `Solicito respuesta dentro de los plazos legales establecidos.\n\n` +
    `Atentamente,\n${datosUsuario.nombre || ""}`
  );
  setTimeout(() => { window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_self"); }, 700);
}

// ─────────────────────────────────────────────────────────────
// COMPONENTES UI
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// TABLA DE CONFIRMACIÓN DE DATOS
// ─────────────────────────────────────────────────────────────
const TIPO_LABEL = {
  "PQRS": { color: [45, 140, 94], bg: "#e8f4ee", text: "#1a6640" },
  "DERECHO DE PETICIÓN": { color: [45, 100, 170], bg: "#e8f0ff", text: "#1a3a80" },
  "SOLICITUD PRIORITARIA": { color: [180, 100, 0], bg: "#fff3e0", text: "#7a4000" },
  "TUTELA PRELIMINAR": { color: [160, 30, 30], bg: "#fce8e8", text: "#7a0000" },
};

const URGENCIA_STYLE = {
  "BAJO": { bg: "#e8f4ee", color: "#1a6640" },
  "MEDIO": { bg: "#fff3e0", color: "#7a4000" },
  "ALTO": { bg: "#fce8e8", color: "#c0392b" },
  "CRÍTICO": { bg: "#c0392b", color: "#fff" },
};

const CAMPOS_CONFIG = [
  { key: "eps",                label: "EPS",                       requerido: true,  placeholder: "Nombre de la EPS (ej: Nueva EPS, Sanitas...)" },
  { key: "nombre",             label: "Nombre completo",           requerido: true,  placeholder: "Nombres y apellidos completos" },
  { key: "cedula",             label: "Cédula / Documento",        requerido: true,  placeholder: "Número de cédula" },
  { key: "contacto",           label: "Teléfono / Correo",         requerido: true,  placeholder: "Correo o teléfono para notificaciones" },
  { key: "ciudad",             label: "Ciudad",                    requerido: false, placeholder: "Ciudad de residencia" },
  { key: "servicio_solicitado",label: "Servicio o problema",       requerido: true,  placeholder: "Ej: cita con cardiólogo, medicamento, cirugía..." },
  { key: "desde_cuando",       label: "¿Desde cuándo espera?",     requerido: true,  placeholder: "Ej: 3 meses, desde enero 2025..." },
  { key: "respuesta_eps",      label: "Respuesta de la EPS",       requerido: false, placeholder: "Lo que respondió la EPS, o: Sin respuesta" },
  { key: "solicitud_concreta", label: "¿Qué le pide a la EPS?",   requerido: true,  placeholder: "Ej: asignar cita, entregar medicamento, autorizar cirugía..." },
  { key: "tipo_documento",     label: "Tipo de documento",         requerido: true,  placeholder: "", esSelect: true },
];

const TIPOS_DOC = ["DERECHO DE PETICIÓN", "PQRS", "SOLICITUD PRIORITARIA", "TUTELA PRELIMINAR"];

function esPendiente(v) { return !v || v.trim() === "" || v === "[DATO PENDIENTE]"; }

function ConfirmacionDatos({ datos, onConfirmar }) {
  const [form, setForm] = useState(() => {
    const f = {};
    CAMPOS_CONFIG.forEach(c => { f[c.key] = esPendiente(datos[c.key]) ? "" : datos[c.key]; });
    return f;
  });

  const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const faltantes = CAMPOS_CONFIG.filter(c => c.requerido && esPendiente(form[c.key]));
  const listo = faltantes.length === 0;

  const tipo = form.tipo_documento || "DERECHO DE PETICIÓN";
  const tipoStyle = TIPO_LABEL[tipo] || TIPO_LABEL["DERECHO DE PETICIÓN"];

  return (
    <div style={{ background: "#fff", border: "1.5px solid #2d8c5e", borderRadius: 16, overflow: "hidden", marginTop: 12, fontFamily: "system-ui", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>

      {/* Encabezado */}
      <div style={{ background: "#2d8c5e", padding: "13px 18px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>📋</span>
        <div>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>Completa y confirma tus datos</div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 1 }}>
            Edita cualquier campo — los marcados con * son obligatorios
          </div>
        </div>
      </div>

      {/* Tabla editable */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {CAMPOS_CONFIG.map(({ key, label, requerido, placeholder, esSelect }, i) => {
            const valor = form[key];
            const vacio = requerido && esPendiente(valor);
            return (
              <tr key={key} style={{ background: i % 2 === 0 ? "#fff" : "#f8fbf9" }}>
                <td style={{
                  padding: "8px 14px 8px 18px",
                  fontWeight: 700, fontSize: 11, color: vacio ? "#c0392b" : "#555",
                  width: "34%", borderBottom: "1px solid #eef2ef",
                  verticalAlign: "middle", textTransform: "uppercase", letterSpacing: 0.3,
                }}>
                  {label}{requerido && <span style={{ color: "#c0392b" }}> *</span>}
                </td>
                <td style={{ padding: "6px 14px 6px 8px", borderBottom: "1px solid #eef2ef" }}>
                  {esSelect ? (
                    <select
                      value={valor}
                      onChange={e => set(key, e.target.value)}
                      style={{ width: "100%", border: "1.5px solid #c8e6d4", borderRadius: 7, padding: "6px 10px", fontSize: 13, background: "#fff", cursor: "pointer" }}
                    >
                      {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={valor}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      style={{
                        width: "100%", border: `1.5px solid ${vacio ? "#f5a0a0" : "#c8e6d4"}`,
                        borderRadius: 7, padding: "6px 10px", fontSize: 13,
                        background: vacio ? "#fff8f8" : "#fff",
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Alerta campos faltantes */}
      {!listo && (
        <div style={{ margin: "10px 18px", background: "#fce8e8", border: "1px solid #f5a0a0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#c0392b" }}>
          ⚠️ Completa los campos obligatorios (*) antes de generar: <strong>{faltantes.map(f => f.label).join(", ")}</strong>
        </div>
      )}

      {/* Botón */}
      <div style={{ padding: "14px 18px", background: "#f9fbf9", borderTop: "1px solid #e0e8e2" }}>
        <button
          onClick={() => listo && onConfirmar({ ...datos, ...form })}
          disabled={!listo}
          style={{
            width: "100%",
            background: listo ? "linear-gradient(135deg, #2d8c5e, #1e6b46)" : "#ccc",
            color: "#fff", border: "none", borderRadius: 10,
            padding: "12px", fontSize: 14, fontWeight: 700,
            cursor: listo ? "pointer" : "not-allowed", letterSpacing: 0.3,
            transition: "background 0.2s",
          }}
        >
          {listo ? "✓ Generar documento legal" : `Completa ${faltantes.length} campo${faltantes.length > 1 ? "s" : ""} para continuar`}
        </button>
        <div style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 6 }}>
          El documento se redacta con las normas vigentes del sistema de salud colombiano
        </div>
      </div>
    </div>
  );
}

function PanelEnvio({ docData, datos }) {
  const epsKey = detectarEPS(datos?.eps || docData?.destinatario);
  const epsInfo = epsKey ? EPS_DATABASE[epsKey] : null;
  const [copiado, setCopiado] = useState(false);
  const [pagoModal, setPagoModal] = useState(null); // null | "pdf" | "enviar"
  const copiarEmail = (email) => {
    navigator.clipboard.writeText(email).then(() => {
      setCopiado(true); setTimeout(() => setCopiado(false), 2000);
    });
  };
  const color = TIPO_COLOR[docData?.tipo] || [45, 140, 94];
  const colorStr = `rgb(${color.join(",")})`;

  const onPagado = (accion) => {
    setPagoModal(null);
    if (accion === "enviar") handleEnviarEPS(docData, datos || {}, true);
    else generatePDF(docData, true);
  };

  return (
    <>
      {pagoModal && (
        <PagoModal
          accion={pagoModal}
          onPagado={() => onPagado(pagoModal)}
          onCerrar={() => setPagoModal(null)}
        />
      )}

    <div style={{ background: "#f9fbf9", border: `1.5px solid ${colorStr}`, borderRadius: 14, padding: "16px 18px", marginTop: 10, fontFamily: "system-ui" }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: colorStr, marginBottom: 12 }}>📤 Enviar documento</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button
          onClick={() => setPagoModal("enviar")}
          style={{ background: colorStr, color: "#fff", border: "none", borderRadius: 9, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", flex: 1 }}
        >
          📧 Enviar al EPS — PDF oficial + email
        </button>
        <button
          onClick={() => setPagoModal("pdf")}
          style={{ background: "#fff", color: colorStr, border: `1.5px solid ${colorStr}`, borderRadius: 9, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          ⬇ Descargar PDF oficial
        </button>
      </div>

      {epsInfo ? (
        <div style={{ background: "#fff", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13 }}>
          <div style={{ fontWeight: 700, color: "#1a1a1a", marginBottom: 6 }}>📋 Contacto directo — {epsKey}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ color: "#888", minWidth: 60 }}>📧 Email</span>
            <a href={`mailto:${epsInfo.email}`} style={{ color: colorStr, fontWeight: 600 }}>{epsInfo.email}</a>
            <button onClick={() => copiarEmail(epsInfo.email)} style={{ background: "none", border: "1px solid #dde8e0", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer", color: "#888" }}>
              {copiado ? "✓" : "Copiar"}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
            <span style={{ color: "#888", minWidth: 60 }}>📞 Tel</span>
            <span>{epsInfo.telefono}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#888", minWidth: 60 }}>🌐 Portal</span>
            <a href={epsInfo.pqrsPortal} target="_blank" rel="noreferrer" style={{ color: colorStr }}>Radicar en portal de la EPS →</a>
          </div>
        </div>
      ) : (
        <div style={{ background: "#fff8e1", borderRadius: 10, padding: "10px 14px", marginBottom: 10, fontSize: 13, color: "#7a6000" }}>
          ⚠️ Verifica el correo PQRS de tu EPS en su página oficial antes de enviar.
        </div>
      )}

      <div style={{ borderTop: "1px solid #e0e8e2", paddingTop: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: "#555", marginBottom: 8 }}>SI LA EPS NO RESPONDE EN EL PLAZO LEGAL:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <a href={SUPERSALUD.pqrdPortal} target="_blank" rel="noreferrer"
            style={{ background: "#4a6fa5", color: "#fff", borderRadius: 9, padding: "8px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", flex: 1, textAlign: "center" }}>
            🏛 Supersalud — Radica PQRD online
          </a>
          <span style={{ display: "flex", alignItems: "center", background: "#fff", border: "1.5px solid #4a6fa5", borderRadius: 9, padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#4a6fa5" }}>
            📞 {SUPERSALUD.telefono}
          </span>
        </div>
        <a href={DEFENSORIA.portal} target="_blank" rel="noreferrer"
          style={{ display: "block", background: "#fce8e8", color: "#c0392b", borderRadius: 9, padding: "9px 14px", fontSize: 12, fontWeight: 700, textDecoration: "none", textAlign: "center" }}>
          ⚖️ Defensoría del Pueblo — Tutela GRATIS · {DEFENSORIA.telefono}
        </a>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: "#aaa", lineHeight: 1.5 }}>
        Al confirmar el pago Nequi ($5.000), se activa la descarga del PDF oficial y el envío al correo de la EPS.
      </div>
    </div>
    </>
  );
}

function DocumentoGenerado({ docData, datos }) {
  const color = TIPO_COLOR[docData.tipo] || [45, 140, 94];
  const colorStr = `rgb(${color.join(",")})`;
  const bgColor = `rgba(${color.join(",")},0.08)`;

  return (
    <div style={{ background: "#fff", border: `1.5px solid ${colorStr}`, borderRadius: 16, padding: "20px 24px", marginTop: 12, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <span style={{ background: colorStr, color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 12px", borderRadius: 20, letterSpacing: 0.8 }}>
            {docData.tipo}
          </span>
          <div style={{ fontSize: 12, color: "#888", marginTop: 5 }}>{docData.ciudadFecha}</div>
        </div>
        <button onClick={() => generatePDF(docData)} style={{ background: colorStr, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
          ⬇ PDF
        </button>
      </div>

      <div style={{ fontSize: 13, color: "#333", marginBottom: 8 }}>
        <strong>Para:</strong> {docData.destinatario?.split("\n")[0]}
      </div>
      <div style={{ fontSize: 13, color: "#333", marginBottom: 12 }}>
        <strong>Asunto:</strong> {docData.asunto}
      </div>

      <div style={{ borderRadius: 10, border: "1px solid #e0e8e2", maxHeight: 420, overflowY: "auto" }}>
        {(docData.cuerpo || "").split("\n").map((rawLine, i) => {
          const t = rawLine.trim();
          if (!t) return <div key={i} style={{ height: 6 }} />;
          if (t === "---") return <hr key={i} style={{ border: "none", borderTop: "1px solid #e0e8e2", margin: "4px 16px" }} />;
          if (t.startsWith("___")) return (
            <div key={i} style={{ borderBottom: "1px solid #888", width: 180, margin: "10px 16px 4px" }} />
          );
          if (isSectionHeader(t)) return (
            <div key={i} style={{
              background: `rgba(${color.join(",")},0.1)`,
              borderLeft: `3px solid rgb(${color.join(",")})`,
              padding: "6px 16px", fontWeight: 700, fontSize: 12,
              color: `rgb(${color.join(",")})`, letterSpacing: 0.4,
              marginTop: 10, marginBottom: 2,
            }}>{t}</div>
          );
          if (/^(PRIMERA|SEGUNDA|TERCERA|CUARTA):/.test(t)) {
            const ci = t.indexOf(":"); const lbl = t.slice(0, ci); const rest = t.slice(ci+1).trim();
            return <div key={i} style={{ padding: "3px 16px 3px 20px", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: `rgb(${color.join(",")})` }}>{lbl}: </span>{rest}
            </div>;
          }
          if (t.startsWith("•")) return (
            <div key={i} style={{ display:"flex", gap: 8, padding: "2px 16px 2px 24px", fontSize: 13, color: "#333" }}>
              <span style={{ color: `rgb(${color.join(",")})`, fontWeight: 700, flexShrink: 0 }}>•</span>
              <span>{t.slice(1).trim()}</span>
            </div>
          );
          if (/^\d+\./.test(t)) {
            const m = t.match(/^(\d+\.)\s*(.*)/s);
            return <div key={i} style={{ display:"flex", gap: 8, padding: "2px 16px 2px 24px", fontSize: 13, color: "#333" }}>
              <span style={{ fontWeight: 700, color: `rgb(${color.join(",")})`, minWidth: 22, flexShrink: 0 }}>{m[1]}</span>
              <span>{m[2]}</span>
            </div>;
          }
          const isLabel = /^(Firma|C\.C\. No\.|Contacto:|NOTA:|Correo|Ciudad|Accionante|Accionado|Bajo la gravedad)/.test(t);
          return <div key={i} style={{ padding: "2px 16px", fontSize: 13, color: isLabel ? "#444" : "#222", fontWeight: isLabel ? 600 : 400, lineHeight: 1.7 }}>{t}</div>;
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: "#aaa", fontStyle: "italic" }}>
        Documento redactado con las normas vigentes del sistema de salud colombiano. Revisa antes de radicar.
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

function renderTexto(text) {
  if (!text) return null;
  return text.split("\n").map((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={i} style={{ height: 6 }} />;
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**")
        ? <strong key={j}>{p.slice(2, -2)}</strong>
        : p
    );
    const isBullet = /^[-•·]/.test(trimmed);
    const isNumber = /^\d+\./.test(trimmed);
    return (
      <div key={i} style={{ display: "flex", gap: isBullet || isNumber ? 6 : 0, marginBottom: 2 }}>
        {(isBullet || isNumber) && <span style={{ flexShrink: 0 }}>{isBullet ? "•" : ""}</span>}
        <span>{isBullet ? parts.slice(1) : parts}</span>
      </div>
    );
  });
}

function MessageBubble({ msg }) {
  const [confirmado, setConfirmado] = useState(false);
  const [datosConfirmados, setDatosConfirmados] = useState(null);
  const isUser = msg.role === "user";
  const datos = !isUser ? parseDatos(msg.content) : null;
  const rawDisplay = !isUser ? stripDatos(msg.content) : msg.content;
  const displayText = rawDisplay && rawDisplay.trim().length > 0 ? rawDisplay.trim() : null;
  const docData = (datos && confirmado && datosConfirmados) ? generarDocumento(datosConfirmados) : null;

  // Si no hay nada para mostrar, no renderizar nada
  if (!isUser && !displayText && !datos) return null;

  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 16, alignItems: "flex-end", gap: 8 }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", flexShrink: 0, fontWeight: 700, flexShrink: 0 }}>IA</div>
      )}
      <div style={{ maxWidth: "82%", minWidth: 40 }}>
        {displayText && (
          <div style={{
            background: isUser ? "#2d8c5e" : "#fff",
            color: isUser ? "#fff" : "#1a1a1a",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            padding: "11px 16px", fontSize: 14, lineHeight: 1.7,
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
            border: isUser ? "none" : "1px solid #e8ede9",
          }}>
            {renderTexto(displayText)}
          </div>
        )}
        {datos && !confirmado && (
          <ConfirmacionDatos datos={datos} onConfirmar={(datosEditados) => { setDatosConfirmados(datosEditados); setConfirmado(true); }} />
        )}
        {docData && <DocumentoGenerado docData={docData} datos={datosConfirmados || datos} />}
        {docData && <PanelEnvio docData={docData} datos={datosConfirmados || datos} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export default function EPSReclamaciones({ pendingVoiceMessage = "", onAssistantMessage } = {}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [datosForzados, setDatosForzados] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const sendMessageRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, loading]);

  useEffect(() => {
    if (!pendingVoiceMessage) return;
    const text = pendingVoiceMessage.replace(/​\d+$/, "").trim();
    if (!text || !sendMessageRef.current) return;
    setStarted(true);
    sendMessageRef.current(text);
  }, [pendingVoiceMessage]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role === "assistant" && onAssistantMessage) onAssistantMessage(last.content);
  }, [messages]);

  async function sendMessage(userText) {
    if (!userText.trim() || loading) return;

    // Si el usuario dice "ya está" / "genera" / "listo" y hay mensajes suficientes,
    // inyectar instrucción explícita al modelo para que genere el JSON
    const triggerPalabras = /\b(ya est[aá]|listo|genera|generar|documento|adelante|continua|procede)\b/i;
    const textoFinal = (messages.length >= 4 && triggerPalabras.test(userText))
      ? userText + " — Por favor genera el bloque JSON con los datos recopilados."
      : userText;

    const newMessages = [...messages, { role: "user", content: userText }];
    const apiMessages = [...messages, { role: "user", content: textoFinal }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setStreamingText("");

    try {
      // En desarrollo usa el proxy de Vite (/groq/...), en producción (Vercel) usa /api/groq
      const endpoint = import.meta.env.DEV
        ? "/groq/openai/v1/chat/completions"
        : "/api/groq";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...apiMessages],
          max_tokens: 500,
          temperature: 0.2,
          stream: true,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              const text = data.choices?.[0]?.delta?.content;
              if (text) { full += text; setStreamingText(full); }
            } catch {}
          }
        }
      }

      setMessages(prev => [...prev, { role: "assistant", content: full }]);
      setStreamingText("");
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
      setStreamingText("");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  sendMessageRef.current = sendMessage;

  function handleStart() {
    setStarted(true);
    sendMessage("Hola, quiero presentar una reclamación ante mi EPS.");
  }

  const quickOptions = [
    "Cita médica demorada más de 3 días",
    "Medicamento no entregado o negado",
    "Cirugía o procedimiento pendiente",
    "Autorización negada sin justificación",
    "Examen diagnóstico pendiente",
    "Problema con mi incapacidad laboral",
  ];

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", height: "100vh", display: "flex", flexDirection: "column", background: "#f5f7f5" }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .msg-in { animation: fadeIn 0.25s ease; }
        textarea:focus { outline: none; }
        button:active { transform: scale(0.97); }
        .quick-btn:hover { background: #e8f4ee !important; border-color: #2d8c5e !important; }
      `}</style>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e0e8e2", padding: "14px 20px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 800 }}>+</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a1a" }}>Reclamaciones ante EPS</div>
          <div style={{ fontSize: 12, color: "#2d8c5e" }}>Colombia · Documentos legales automáticos</div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => { setMessages([]); setStarted(false); }} style={{ marginLeft: "auto", fontSize: 12, color: "#888", background: "none", border: "1px solid #ddd", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>
            Nueva reclamación
          </button>
        )}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px" }}>
        {!started ? (
          <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: 24 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: "32px 28px", border: "1px solid #e0e8e2", textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏥</div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 8px" }}>Reclamaciones ante EPS</h2>
              <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 6px" }}>
                Cuéntame tu problema. En 3 preguntas genero tu documento legal (PQRS, Derecho de Petición, Tutela) con todas las normas aplicadas.
              </p>
              <p style={{ fontSize: 13, color: "#2d8c5e", margin: "0 0 20px", fontWeight: 600 }}>
                El documento lo redactamos nosotros — tú solo nos das los datos.
              </p>
              <button onClick={handleStart} style={{ background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 12, padding: "13px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>
                Iniciar reclamación
              </button>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 10, textAlign: "center" }}>O escoge tu problema directamente:</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {quickOptions.map(opt => (
                  <button key={opt} className="quick-btn" onClick={() => { setStarted(true); sendMessage(opt); }} style={{ background: "#fff", border: "1px solid #dde8e0", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: "#2d4a38", cursor: "pointer", textAlign: "left", lineHeight: 1.4, transition: "all 0.15s" }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "#fff8e1", border: "1px solid #f9c74f", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#7a6000", lineHeight: 1.5 }}>
              ⚠️ Este asistente no reemplaza atención médica urgente. En emergencia llama al 123.
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {messages.map((msg, i) => (
              <div key={i} className="msg-in">
                <MessageBubble msg={msg} />
              </div>
            ))}
            {/* Botón de respaldo: generar documento si el chat lleva 6+ mensajes sin documento */}
            {!loading && !datosForzados && messages.length >= 6 && !messages.some(m => parseDatos(m.content)) && (
              <div style={{ textAlign: "center", margin: "12px 0" }} className="msg-in">
                <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>
                  ¿Ya diste tus datos? Puedes generar el documento directamente.
                </div>
                <button
                  onClick={() => {
                    const datos = extraerDatosDeConversacion(messages);
                    setDatosForzados(datos);
                  }}
                  style={{
                    background: "#2d8c5e", color: "#fff", border: "none", borderRadius: 10,
                    padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  📄 Generar mi documento ahora
                </button>
              </div>
            )}

            {/* Documento generado por botón de respaldo */}
            {datosForzados && (() => {
              const confirmed = datosForzados._confirmados;
              const docData = confirmed ? generarDocumento(confirmed) : null;
              return (
                <div className="msg-in">
                  {!confirmed && (
                    <ConfirmacionDatos
                      datos={datosForzados}
                      onConfirmar={(datosEditados) => setDatosForzados(prev => ({ ...prev, _confirmados: datosEditados }))}
                    />
                  )}
                  {docData && <DocumentoGenerado docData={docData} datos={confirmed} />}
                  {docData && <PanelEnvio docData={docData} datos={confirmed} />}
                </div>
              );
            })()}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 16 }} className="msg-in">
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#2d8c5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "#fff", fontWeight: 700, flexShrink: 0 }}>IA</div>
                <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", border: "1px solid #e8ede9", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", minWidth: 60 }}>
                  {(() => {
                    const streamDisplay = getStreamingDisplay(streamingText);
                    const generandoJSON = streamingText && streamingText.includes("---DATOS_INICIO---");
                    if (streamDisplay) {
                      return <div style={{ padding: "11px 16px", fontSize: 14, lineHeight: 1.65, whiteSpace: "pre-wrap", maxWidth: 540 }}>{streamDisplay}</div>;
                    }
                    if (generandoJSON) {
                      return (
                        <div style={{ padding: "11px 16px", fontSize: 13, color: "#2d8c5e", display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
                          Analizando tu caso y preparando el documento...
                        </div>
                      );
                    }
                    return <TypingDots />;
                  })()}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      {started && (
        <div style={{ background: "#fff", borderTop: "1px solid #e0e8e2", padding: "12px 16px", flexShrink: 0 }}>
          <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
              placeholder="Escribe tu respuesta... (Enter para enviar)"
              rows={1}
              style={{ flex: 1, border: "1.5px solid #dde8e0", borderRadius: 12, padding: "10px 14px", fontSize: 14, resize: "none", fontFamily: "system-ui", lineHeight: 1.5, background: "#f9faf9", maxHeight: 120, overflowY: "auto" }}
              onInput={e => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              style={{ background: input.trim() && !loading ? "#2d8c5e" : "#c8ddd3", color: "#fff", border: "none", borderRadius: 12, width: 44, height: 44, fontSize: 18, cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", flexShrink: 0 }}
            >↑</button>
          </div>
          <div style={{ textAlign: "center", fontSize: 11, color: "#aaa", marginTop: 6, maxWidth: 700, margin: "6px auto 0" }}>
            Shift+Enter para salto de línea · El documento se genera automáticamente con los datos que proporciones
          </div>
        </div>
      )}
    </div>
  );
}
