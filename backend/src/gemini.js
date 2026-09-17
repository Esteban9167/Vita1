const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.7-flash"
];

const TOOLS = [{
  functionDeclarations: [
    {
      name: "agregar_contacto",
      description: "Agrega un contacto de emergencia.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          relacion: { type: "string", description: "Por ejemplo madre, pareja, médico" },
          telefono: { type: "string" }
        },
        required: ["nombre", "telefono"]
      }
    },
    {
      name: "eliminar_contacto",
      description: "Elimina un contacto de emergencia por id o por nombre.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          nombre: { type: "string" }
        }
      }
    },
    {
      name: "agregar_medicamento",
      description: "Registra un medicamento con dosis y horarios en formato HH:MM.",
      parameters: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          dosis: { type: "string", description: "Por ejemplo 500 mg" },
          horarios: {
            type: "array",
            items: { type: "string" },
            description: "Lista de horas, por ejemplo 08:00 y 20:00"
          }
        },
        required: ["nombre", "horarios"]
      }
    },
    {
      name: "eliminar_medicamento",
      description: "Elimina un medicamento por id o por nombre.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          nombre: { type: "string" }
        }
      }
    },
    {
      name: "marcar_medicamento_tomado",
      description: "Marca o desmarca que un medicamento ya se tomó en un horario de hoy.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          nombre: { type: "string" },
          hora: { type: "string", description: "Horario en HH:MM" }
        },
        required: ["hora"]
      }
    },
    {
      name: "agregar_evento",
      description: "Agenda una cita o evento en el calendario.",
      parameters: {
        type: "object",
        properties: {
          fecha: { type: "string", description: "Fecha YYYY-MM-DD" },
          hora: { type: "string", description: "Hora HH:MM" },
          titulo: { type: "string" },
          tipo: { type: "string", description: "cita, medicamento u otro" }
        },
        required: ["fecha", "titulo"]
      }
    },
    {
      name: "eliminar_evento",
      description: "Elimina un evento del calendario.",
      parameters: {
        type: "object",
        properties: {
          fecha: { type: "string", description: "Fecha YYYY-MM-DD" },
          id: { type: "string" },
          titulo: { type: "string" }
        },
        required: ["fecha"]
      }
    }
  ]
}];

let resolvedModel = "";

function nowLabel() {
  return new Date().toLocaleString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function systemInstruction(snapshot, profile) {
  const rol = profile?.rol === "enfermero" ? "enfermero" : "paciente";
  const nombre = snapshot?.nombre || profile?.nombre || "la persona";
  return `Eres Vita, una compañera de cuidado para una persona que a veces se desorienta. Hablas en español latino, despacio, con calidez y frases cortas. No eres un robot ni un médico.

Hoy es ${nowLabel()}.
La persona se llama ${nombre}.
Quien usa Vita ahora es ${rol}.

Protocolo de orientación (lo más importante):
- Si pregunta quién es, dónde está, quién le habla, si está perdida o asustada, respóndele de inmediato con hechos suaves. Nunca la contradigas con dureza.
- Nunca digas: te olvidaste, ya te lo dije, tienes Alzheimer, tienes demencia, no recuerdas, otra vez lo mismo, estás confundida.
- No la interrogues. No le hagas un examen de memoria. No pidas que intente recordar.
- Orden cuando esté desorientada: 1) tranquilizar 2) quién le habla 3) quién es ella 4) dónde está 5) ofrecer una sola ayuda, como quedarse o llamar a un familiar.
- Usa su nombre. Frases cortas. Tono de compañía, no de alarma.
- Si se repite la misma pregunta, vuelve a responder completo, como si fuera la primera vez, con la misma calma.

Personalidad:
- Eres compañera de cuidado: escuchas, animas y orientas sin asustar.
- ${rol === "enfermero" ? "Si habla un enfermero, ayúdalo a orientar al paciente con el mismo tono suave." : "Si habla el paciente, cuídalo con ternura práctica, sin infantilizarlo."}
- Nunca diagnostiques, recetes ni inventes resultados médicos.
- PROHIBIDO modificar la historia clínica: alergias, tipo de sangre, condiciones crónicas, cirugías u notas. El paciente no puede cambiarlas y tú tampoco.
- Si te piden registrar, cambiar o borrar medicamentos, contactos o citas, USA las herramientas. Luego confirma con naturalidad.
- Respuestas pensadas para voz: 1 a 4 frases. Sin markdown, sin asteriscos, sin emojis.

Datos actuales de Vita:
${JSON.stringify(snapshot || {})}`;
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/`/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractParts(payload) {
  return payload?.candidates?.[0]?.content?.parts || [];
}

function extractText(payload) {
  return extractParts(payload)
    .map((part) => part.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractCalls(payload) {
  return extractParts(payload)
    .filter((part) => part.functionCall?.name)
    .map((part) => ({
      name: part.functionCall.name,
      args: part.functionCall.args || {}
    }));
}

async function postGemini(model, body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY
      },
      body: JSON.stringify(body)
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error?.message || `Gemini ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return data;
}

async function generate(model, contents, snapshot, profile) {
  return postGemini(model, {
    systemInstruction: { parts: [{ text: systemInstruction(snapshot, profile) }] },
    contents,
    tools: TOOLS,
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: {
      temperature: 0.85,
      maxOutputTokens: 512
    }
  });
}

async function generateWithFallback(contents, snapshot, profile) {
  const models = resolvedModel
    ? [resolvedModel, ...GEMINI_MODELS.filter((m) => m !== resolvedModel)]
    : GEMINI_MODELS;
  let lastError;
  for (const model of models) {
    try {
      const payload = await generate(model, contents, snapshot, profile);
      resolvedModel = model;
      return payload;
    } catch (error) {
      lastError = error;
      if (error.status === 401 || error.status === 403 || error.status === 429) throw error;
      if (!error.status) throw error;
      resolvedModel = "";
    }
  }
  throw lastError || new Error("No hay un modelo de Gemini disponible.");
}

export function publicGeminiError(error) {
  if (error?.status === 401 || error?.status === 403) {
    return "No pude conectar con Gemini. Revisa la clave en el servidor.";
  }
  if (error?.status === 429) {
    return "Estoy un poco ocupada ahora. Inténtalo en un momento.";
  }
  return error?.message || "No se pudo completar la respuesta.";
}

export async function geminiTurn({ contents, snapshot, profile }) {
  const payload = await generateWithFallback(contents, snapshot, profile);
  const calls = extractCalls(payload);
  if (calls.length) {
    return {
      calls,
      modelContent: payload.candidates?.[0]?.content || null
    };
  }
  const reply = stripMarkdown(extractText(payload));
  if (!reply) {
    const err = new Error("Respuesta vacía de Gemini");
    err.status = payload?.candidates?.[0]?.finishReason === "SAFETY" ? 400 : 502;
    throw err;
  }
  return { reply };
}
