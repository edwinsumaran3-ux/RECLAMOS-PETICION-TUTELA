import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// PANEL MULTIMEDIA FLOTANTE — Etapa 5/6 EPS Reclamaciones
//
// Props:
//   onTranscript(texto)   — se llama cuando hay transcripción final
//   onAccion(tipo)        — 'narrar' | 'documento' | 'seguimiento' | 'urgencia'
//   iaHablando            — bool: true cuando la IA está respondiendo en audio
//   onDetenerIA()         — para detener el TTS de la IA desde afuera
//   defaultPos            — { bottom, right } posición inicial (px)
//
// Uso:
//   <PanelMultimediaFlotante
//     onTranscript={(txt) => handleVozMessage(txt)}
//     onAccion={(tipo) => handleAccion(tipo)}
//     iaHablando={isSpeaking}
//     onDetenerIA={stopSpeaking}
//   />
// ─────────────────────────────────────────────────────────────

function OndaAnimada({ activa, color = "#2d8c5e" }) {
  const bars = 20;
  const base = [6, 10, 7, 14, 8, 18, 9, 12, 7, 16, 8, 11, 6, 14, 9, 13, 7, 10, 15, 8];
  const [alturas, setAlturas] = useState(base);

  useEffect(() => {
    if (!activa) { setAlturas(base); return; }
    const iv = setInterval(() => {
      setAlturas(prev => prev.map(() => Math.round(4 + Math.random() * 22)));
    }, 100);
    return () => clearInterval(iv);
  }, [activa]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, height: 28, padding: "0 14px 6px" }}>
      {alturas.map((h, i) => (
        <div key={i} style={{
          width: 3, height: h, borderRadius: 2,
          background: activa ? color : "#d0d0d0",
          transition: "height 0.1s, background 0.3s",
        }} />
      ))}
    </div>
  );
}

export default function PanelMultimediaFlotante({
  onTranscript,
  onAccion,
  iaHablando = false,
  onDetenerIA,
  defaultPos = { bottom: 80, right: 16 },
}) {
  const [estado, setEstado] = useState("espera"); // espera | escuchando | procesando | hablando
  const [transcripcion, setTranscripcion] = useState("");
  const [pos, setPos] = useState(defaultPos);
  const [minimizado, setMinimizado] = useState(false);
  const [soportado, setSoportado] = useState(true);

  const recognitionRef = useRef(null);
  const panelRef = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origBottom: 0, origRight: 0 });
  const transcripcionFinalRef = useRef("");

  // Detectar soporte de voz
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) setSoportado(false);
  }, []);

  // Sincronizar estado con prop iaHablando
  useEffect(() => {
    if (iaHablando) setEstado("hablando");
    else if (estado === "hablando") setEstado("espera");
  }, [iaHablando]);

  // Barra espaciadora — mantén para hablar, suelta para enviar
  useEffect(() => {
    function onKeyDown(e) {
      if (e.code !== "Space" || e.repeat) return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      if (estado === "espera") iniciarMic();
    }
    function onKeyUp(e) {
      if (e.code !== "Space") return;
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      if (estado === "escuchando") detenerMic();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [estado]);

  // ── Micrófono ──
  const iniciarMic = useCallback(() => {
    setEstado("escuchando");
    setTranscripcion("");
    transcripcionFinalRef.current = "";

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return; // sin soporte — UI simula estado

    const rec = new SR();
    rec.lang = "es-CO";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const texto = Array.from(event.results).map(r => r[0].transcript).join("");
      setTranscripcion(texto);
      if (event.results[event.results.length - 1].isFinal) {
        transcripcionFinalRef.current = texto;
      }
    };

    rec.onend = () => {
      const final = transcripcionFinalRef.current;
      transcripcionFinalRef.current = "";
      setEstado("procesando");
      setTimeout(() => {
        setEstado("espera");
        if (final && onTranscript) onTranscript(final);
      }, 400);
    };

    rec.onerror = () => {
      setEstado("espera");
      setTranscripcion("Error de micrófono. Intenta nuevamente.");
    };

    try { rec.start(); recognitionRef.current = rec; } catch {}
  }, [onTranscript]);

  const detenerMic = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    recognitionRef.current = null;
  }, []);

  const toggleMic = useCallback(() => {
    if (estado === "escuchando") detenerMic();
    else if (estado === "espera") iniciarMic();
    else if (estado === "hablando" && onDetenerIA) onDetenerIA();
  }, [estado, iniciarMic, detenerMic, onDetenerIA]);

  // ── Drag (mouse + touch) ──
  function onDragStart(clientX, clientY) {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const parent = panel.offsetParent?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    dragRef.current = {
      dragging: true,
      startX: clientX,
      startY: clientY,
      origRight: parseInt(panel.style.right) || pos.right,
      origBottom: parseInt(panel.style.bottom) || pos.bottom,
    };
  }

  function onDragMove(clientX, clientY) {
    if (!dragRef.current.dragging) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    setPos({
      right: Math.max(0, dragRef.current.origRight - dx),
      bottom: Math.max(0, dragRef.current.origBottom - dy),
    });
  }

  function onDragEnd() { dragRef.current.dragging = false; }

  useEffect(() => {
    function mm(e) { onDragMove(e.clientX, e.clientY); }
    function mu() { onDragEnd(); }
    function tm(e) { if (e.touches[0]) onDragMove(e.touches[0].clientX, e.touches[0].clientY); }
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    window.addEventListener("touchmove", tm, { passive: true });
    window.addEventListener("touchend", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", mu);
    };
  }, []);

  // ── Estilos dinámicos según estado ──
  const micColors = {
    espera: { bg: "#f0f9f4", border: "#c8e6d4", icon: "🎤", iconColor: "#2d8c5e" },
    escuchando: { bg: "#fce8e8", border: "#f7c1c1", icon: "⏹", iconColor: "#c0392b" },
    procesando: { bg: "#e8f0fe", border: "#b5d4f4", icon: "⏳", iconColor: "#185fa5" },
    hablando: { bg: "#e8f0fe", border: "#b5d4f4", icon: "🔊", iconColor: "#185fa5" },
  };

  const estadoLabel = {
    espera: "Listo para escuchar",
    escuchando: "Escuchando...",
    procesando: "Procesando...",
    hablando: "IA respondiendo",
  };

  const estadoDotColor = {
    espera: "#d0d0d0",
    escuchando: "#c0392b",
    procesando: "#185fa5",
    hablando: "#185fa5",
  };

  const mc = micColors[estado];

  const acciones = [
    { tipo: "narrar", icono: "💬", label: "Narrar caso", color: "#2d8c5e", bg: "#f0f9f4", border: "#c8e6d4" },
    { tipo: "documento", icono: "📄", label: "Preparar doc", color: "#185fa5", bg: "#e6f1fb", border: "#b5d4f4" },
    { tipo: "seguimiento", icono: "📊", label: "Seguimiento", color: "#854f0b", bg: "#faeeda", border: "#fac775" },
    { tipo: "urgencia", icono: "🚨", label: "Es urgente", color: "#a32d2d", bg: "#fcebeb", border: "#f7c1c1" },
  ];

  // ── Render ──
  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        bottom: pos.bottom,
        right: pos.right,
        width: minimizado ? 58 : 300,
        zIndex: 9999,
        background: "#fff",
        border: "0.5px solid #e0e0e0",
        borderRadius: 20,
        boxShadow: "0 4px 24px rgba(0,0,0,0.13)",
        overflow: "hidden",
        transition: "width 0.25s ease",
        fontFamily: "system-ui, sans-serif",
        userSelect: "none",
      }}
    >
      {/* Handle de arrastre */}
      <div
        onMouseDown={e => onDragStart(e.clientX, e.clientY)}
        onTouchStart={e => onDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        style={{
          height: 28, display: "flex", alignItems: "center",
          justifyContent: minimizado ? "center" : "space-between",
          padding: "0 10px",
          background: "#f9faf9", borderBottom: "0.5px solid #e8ede9",
          cursor: "grab",
        }}
      >
        {!minimizado && (
          <span style={{ fontSize: 10, color: "#aaa", fontWeight: 600, letterSpacing: 0.5 }}>PANEL MULTIMEDIA</span>
        )}
        <div style={{ width: 28, height: 4, borderRadius: 2, background: "#d0d0d0" }} />
        {!minimizado && (
          <button
            onClick={() => setMinimizado(true)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 16, lineHeight: 1, padding: 2 }}
            aria-label="Minimizar"
          >−</button>
        )}
      </div>

      {/* Minimizado: solo botón mic */}
      {minimizado && (
        <div style={{ padding: "10px 6px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <button
            onClick={toggleMic}
            style={{
              width: 46, height: 46, borderRadius: "50%", border: `1.5px solid ${mc.border}`,
              background: mc.bg, fontSize: 20, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            aria-label={estadoLabel[estado]}
          >{mc.icon}</button>
          <button
            onClick={() => setMinimizado(false)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 11 }}
            aria-label="Expandir"
          >▲</button>
        </div>
      )}

      {/* Panel expandido */}
      {!minimizado && (
        <>
          {/* Botón micrófono principal */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px 6px" }}>
            <button
              onClick={toggleMic}
              style={{
                width: 60, height: 60, borderRadius: "50%", border: `1.5px solid ${mc.border}`,
                background: mc.bg, fontSize: 24, cursor: "pointer", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                animation: estado === "escuchando" ? "pulseMic 0.7s ease-in-out infinite alternate" : "none",
                transition: "background 0.2s, border-color 0.2s",
              }}
              aria-label={estadoLabel[estado]}
            >{mc.icon}</button>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#1a1a1a", marginBottom: 3 }}>{estadoLabel[estado]}</div>
              <div style={{ fontSize: 11, color: "#888" }}>
                {estado === "escuchando"
                  ? "Suelta [Espacio] o toca ⏹ para detener"
                  : estado === "hablando"
                  ? "Toca 🔊 para interrumpir"
                  : "Mantén [Espacio] o toca 🎤 para hablar"}
              </div>
              {/* Dot de estado */}
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: estadoDotColor[estado],
                  animation: estado !== "espera" ? "pulseMic 0.8s ease-in-out infinite alternate" : "none",
                }} />
                <span style={{ fontSize: 10, color: "#aaa" }}>{estado === "espera" ? "En espera" : estado}</span>
              </div>
            </div>
          </div>

          {/* Onda de audio */}
          <OndaAnimada activa={estado === "escuchando" || estado === "hablando"} color={estado === "escuchando" ? "#c0392b" : "#185fa5"} />

          {/* Transcripción */}
          <div style={{
            margin: "0 14px 10px", padding: "8px 10px",
            background: "#f9faf9", border: "0.5px solid #e8ede9",
            borderRadius: 10, fontSize: 12, color: estado === "escuchando" ? "#1a1a1a" : "#aaa",
            minHeight: 36, lineHeight: 1.5, fontStyle: estado === "escuchando" ? "normal" : "italic",
          }}>
            {transcripcion || (estado === "espera" ? "La transcripción de tu voz aparecerá aquí..." : "...")}
          </div>

          {/* Barra espaciadora */}
          <div
            onMouseDown={toggleMic}
            onTouchStart={e => { e.preventDefault(); if (estado === "espera") iniciarMic(); }}
            onTouchEnd={e => { e.preventDefault(); if (estado === "escuchando") detenerMic(); }}
            style={{
              margin: "0 14px 10px", padding: "11px 14px",
              background: estado === "escuchando" ? "#fce8e8" : estado === "espera" ? "#f9faf9" : "#e8f0fe",
              border: `0.5px solid ${estado === "escuchando" ? "#f7c1c1" : "#e0e0e0"}`,
              borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
              gap: 10, cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
            }}
            role="button"
            aria-label="Barra espaciadora — mantén para hablar"
            tabIndex={0}
          >
            <span style={{ fontSize: 16 }}>
              {estado === "escuchando" ? "⏹" : estado === "hablando" ? "🔊" : "🎙"}
            </span>
            <span style={{ fontWeight: 600, fontSize: 12, color: "#333" }}>
              {estado === "escuchando" ? "Suelta para enviar" : "Mantén para hablar"}
            </span>
            <span style={{
              fontSize: 10, fontFamily: "monospace", background: "#fff",
              border: "0.5px solid #ddd", borderRadius: 4, padding: "2px 7px", color: "#888",
            }}>ESPACIO</span>
          </div>

          {/* Divisor */}
          <div style={{ height: "0.5px", background: "#e8ede9", margin: "0 14px" }} />

          {/* Acciones rápidas */}
          <div style={{ padding: "8px 14px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#aaa", letterSpacing: 0.5, marginBottom: 7 }}>
              ACCIONES RÁPIDAS
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {acciones.map(a => (
                <button
                  key={a.tipo}
                  onClick={() => { if (onAccion) onAccion(a.tipo); }}
                  style={{
                    padding: "9px 8px", borderRadius: 10,
                    border: `0.5px solid ${a.border}`, background: a.bg,
                    color: a.color, fontSize: 12, fontWeight: 600,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    textAlign: "left", lineHeight: 1.3, transition: "opacity 0.1s",
                  }}
                  onMouseDown={e => e.currentTarget.style.opacity = "0.75"}
                  onMouseUp={e => e.currentTarget.style.opacity = "1"}
                >
                  <span style={{ fontSize: 15, flexShrink: 0 }}>{a.icono}</span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          </div>

          <style>{`
            @keyframes pulseMic {
              from { transform: scale(1); }
              to   { transform: scale(1.06); }
            }
          `}</style>
        </>
      )}
    </div>
  );
}
