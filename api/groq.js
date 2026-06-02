// Vercel Edge Function — proxy seguro hacia GROQ API
// La API key se guarda en las variables de entorno de Vercel, nunca en el código.

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "GROQ_API_KEY no configurada en las variables de entorno de Vercel." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.text();

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body,
  });

  // Reenviar la respuesta en streaming directamente al cliente
  return new Response(groqRes.body, {
    status: groqRes.status,
    headers: {
      "Content-Type": groqRes.headers.get("Content-Type") || "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
