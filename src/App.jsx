import { useState, useRef, useCallback } from "react";
import EPSReclamaciones from "../reclamos-eps.jsx";
import PanelMultimediaFlotante from "../PanelMultimediaFlotante.jsx";

const ACCION_MESSAGES = {
  narrar:     "Quiero contarte mi caso completo",
  documento:  "Por favor genera el documento de reclamo ahora",
  seguimiento:"¿En qué estado está mi caso y qué plazos tengo?",
  urgencia:   "Mi situación es urgente, necesito atención inmediata",
};

function cleanForTTS(text) {
  if (!text) return "";

  let clean = text
    // Eliminar bloques JSON / marcadores
    .replace(/---[A-Z_]+---[\s\S]*?---[A-Z_]+---/g, "")
    .replace(/\{[\s\S]*?"tipo_documento"[\s\S]*?\}/g, "")
    // Eliminar markdown
    .replace(/[*_`#\[\]>]/g, "")
    // Eliminar URLs
    .replace(/https?:\/\/\S+/g, "")
    // Eliminar emojis y símbolos técnicos
    .replace(/[⚠️📋📄🏥⬇📧🌐📞⚖️🏛]/gu, "")
    // Normalizar saltos de línea y espacios
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Cortar en el último punto, signo de exclamación o pregunta antes del límite
  const LIMITE = 380;
  if (clean.length > LIMITE) {
    const hayPunto = Math.max(
      clean.lastIndexOf(". ", LIMITE),
      clean.lastIndexOf("! ", LIMITE),
      clean.lastIndexOf("? ", LIMITE),
    );
    if (hayPunto > 80) {
      clean = clean.slice(0, hayPunto + 1);
    } else {
      // Si no hay punto, cortar en el último espacio (nunca a mitad de palabra)
      const ultimoEspacio = clean.lastIndexOf(" ", LIMITE);
      clean = clean.slice(0, ultimoEspacio > 0 ? ultimoEspacio : LIMITE);
    }
  }

  return clean;
}

export default function App() {
  const [pendingVoiceMessage, setPendingVoiceMessage] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const synthRef = useRef(window.speechSynthesis);

  const triggerMessage = useCallback((text) => {
    // Añade timestamp para que el useEffect detecte cambios aunque el texto sea igual
    setPendingVoiceMessage(text + "​" + Date.now());
  }, []);

  const handleTranscript = useCallback((text) => {
    if (text?.trim()) triggerMessage(text.trim());
  }, [triggerMessage]);

  const handleAccion = useCallback((tipo) => {
    const msg = ACCION_MESSAGES[tipo];
    if (msg) triggerMessage(msg);
  }, [triggerMessage]);

  const handleAssistantMessage = useCallback((text) => {
    const clean = cleanForTTS(text);
    if (!clean) return;
    synthRef.current?.cancel();
    const utt = new SpeechSynthesisUtterance(clean);
    utt.lang = "es-CO";
    utt.rate = 0.88;   // más pausado, más natural
    utt.pitch = 1.05;  // tono ligeramente más cálido
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    synthRef.current?.speak(utt);
  }, []);

  const stopSpeaking = useCallback(() => {
    synthRef.current?.cancel();
    setIsSpeaking(false);
  }, []);

  return (
    <>
      <EPSReclamaciones
        pendingVoiceMessage={pendingVoiceMessage}
        onAssistantMessage={handleAssistantMessage}
      />
      <PanelMultimediaFlotante
        onTranscript={handleTranscript}
        onAccion={handleAccion}
        iaHablando={isSpeaking}
        onDetenerIA={stopSpeaking}
      />
    </>
  );
}
