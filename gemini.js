const GEMINI_API_KEY = "AQ.Ab8RN6LazM1By1DYWleJFbPsCnlNPwUMu-jmbwN334f0BhJ2BA";

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
let chatHistory = [];

function findByName(list, nombre) {
  const q = String(nombre || "").trim().toLowerCase();
  if (!q) return null;
  return list.find((item) => String(item.nombre).toLowerCase() === q)
    || list.find((item) => String(item.nombre).toLowerCase().includes(q));
}

function runVitaTool(name, args, vita) {
  const a = args || {};
  switch (name) {
    case "guardar_historia":
      return { ok: false, error: "La historia clínica no se puede modificar desde el asistente ni por el paciente. Solo un enfermero puede actualizarla en la app." };
    case "agregar_contacto":
      return { ok: true, contacto: vita.agregarContacto({ nombre: a.nombre, relacion: a.relacion, telefono: a.telefono }) };
    case "eliminar_contacto": {
      const found = vita.obtenerContactos().find((c) => c.id === a.id) || findByName(vita.obtenerContactos(), a.nombre);
      if (!found) return { ok: false, error: "No encontré ese contacto." };
      vita.eliminarContacto(found.id);
      return { ok: true, eliminado: found.nombre };
    }
    case "agregar_medicamento":
    case "eliminar_medicamento":
    case "guardar_medicamento":
      return {
        ok: false,
        refused: true,
        error: "No cambies medicamentos desde el asistente. Tranquiliza a la persona y dile con suavidad que eso se lo consultarás a su doctor, sin registrarlo."
      };
    case "marcar_medicamento_tomado": {
      const found = vita.obtenerMedicamentos().find((m) => String(m.id) === String(a.id)) || findByName(vita.obtenerMedicamentos(), a.nombre);
      if (!found) return { ok: false, error: "No encontré ese medicamento." };
      const tomado = vita.marcarMedicamentoTomado(found.id, a.hora);
      return { ok: true, nombre: found.nombre, hora: a.hora, tomado };
    }
    case "agregar_evento": {
      const evento = vita.agregarEvento({
        fecha: a.fecha,
        hora: a.hora || "09:00",
        titulo: a.titulo,
        tipo: a.tipo || "cita"
      });
      return { ok: true, evento: { ...evento, fecha: a.fecha } };
    }
    case "eliminar_evento": {
      const items = vita.obtenerEventos(a.fecha);
      const found = items.find((e) => e.id === a.id)
        || items.find((e) => String(e.titulo).toLowerCase().includes(String(a.titulo || "").toLowerCase()));
      if (!found) return { ok: false, error: "No encontré ese evento." };
      vita.eliminarEvento(a.fecha, found.id);
      return { ok: true, eliminado: found.titulo, fecha: a.fecha };
    }
    default:
      return { ok: false, error: "Herramienta no disponible." };
  }
}

function buildSnapshot(vita) {
  const historia = vita.obtenerHistoria();
  const meds = vita.obtenerMedicamentos().map((med) => ({
    id: med.id,
    nombre: med.nombre,
    dosis: med.dosis,
    horarios: med.horarios
  }));
  const contactos = vita.obtenerContactos().map((c) => ({
    id: c.id,
    nombre: c.nombre,
    relacion: c.relacion,
    telefono: c.telefono
  }));
  const hoy = vita.medicamentosDeHoy();
  const proximo = vita.obtenerProximoEvento();
  const eventosProximos = [];
  const start = new Date();
  for (let i = 0; i < 14; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const fecha = vita.formatearFecha(d);
    const items = vita.obtenerEventos(fecha);
    if (items.length) eventosProximos.push({ fecha, items });
  }
  return {
    nombre: vita.getPatientName(),
    historia,
    medicamentos: meds,
    medicamentosHoy: hoy,
    contactos,
    proximoEvento: proximo
      ? { titulo: proximo.titulo, fecha: proximo.fecha, hora: proximo.hora, tipo: proximo.tipo, id: proximo.id }
      : null,
    eventosProximos,
    orientacion: vita.obtenerOrientacion()
  };
}

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
- PROHIBIDO agregar, quitar o cambiar medicamentos desde el asistente. El paciente puede alterarse. No uses herramientas para eso. No finjas que ya lo guardaste.
- Si pide un medicamento nuevo, cambiar la dosis o borrarlo: tranquilízala, dile que lo vas a consultar con su doctor y que por ahora no cambias nada. Frases cortas, tono de compañía.
- Si te piden registrar o borrar contactos o citas, USA las herramientas. Luego confirma con naturalidad.
- Habla como una persona al lado, no como un sistema: giros naturales, sin tono de manual. No enumeres 1) 2) 3) en voz alta. No digas procesando, entendido, correcto ni similar.
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

function coerceArgs(args) {
  if (!args) return {};
  if (typeof args === "string") {
    try { return JSON.parse(args); } catch { return {}; }
  }
  return args;
}

function extractCalls(payload) {
  return extractParts(payload)
    .filter((part) => part.functionCall?.name)
    .map((part) => ({
      name: part.functionCall.name,
      args: coerceArgs(part.functionCall.args)
    }));
}

async function postGemini(model, body) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
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

async function geminiTurn({ contents, snapshot, profile }) {
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

export function resetVitaChat() {
  chatHistory = [];
}

export function geminiErrorMessage(error) {
  if (error?.status === 401 || error?.status === 403) {
    return "No pude conectar con Gemini. Revisa la clave de la API.";
  }
  if (error?.status === 429) {
    return "Estoy un poco ocupada ahora. Inténtalo en un momento.";
  }
  return "";
}

export async function askVita(text, { vita, profile, onDataChanged } = {}) {
  const snapshot = buildSnapshot(vita);
  const contents = chatHistory.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));
  contents.push({ role: "user", parts: [{ text }] });

  let dataChanged = false;
  let payload = await geminiTurn({ contents, snapshot, profile });

  for (let i = 0; i < 5; i += 1) {
    if (!payload.calls?.length) break;
    if (payload.modelContent) contents.push(payload.modelContent);
    const responses = payload.calls.map((call) => {
      let result;
      try {
        result = runVitaTool(call.name, call.args || {}, vita);
        if (result?.ok) dataChanged = true;
      } catch (error) {
        result = { ok: false, error: error.message || "No pude completar esa acción." };
      }
      return {
        functionResponse: {
          name: call.name,
          response: result
        }
      };
    });
    contents.push({ role: "user", parts: responses });
    payload = await geminiTurn({ contents, snapshot: buildSnapshot(vita), profile });
  }

  if (dataChanged) onDataChanged?.();
  if (!payload.reply) {
    const error = new Error("Respuesta vacía de Vita");
    error.status = 502;
    throw error;
  }

  chatHistory.push({ role: "user", text });
  chatHistory.push({ role: "model", text: payload.reply });
  if (chatHistory.length > 16) chatHistory = chatHistory.slice(-16);
  return payload.reply;
}
