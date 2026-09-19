import { auth } from "./firebase.js?v=care14";

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

async function geminiTurn({ contents, snapshot, profile }) {
  const user = auth.currentUser;
  if (!user) {
    const err = new Error("Inicia sesión.");
    err.status = 401;
    throw err;
  }
  const token = await user.getIdToken();
  const response = await fetch("/api/chat/turn", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ contents, snapshot, profile })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data.error || `Gemini ${response.status}`);
    err.status = data.status || response.status;
    throw err;
  }
  return data;
}

export function resetVitaChat() {
  chatHistory = [];
}

export function geminiErrorMessage(error) {
  if (error?.status === 401 && /inicia sesión/i.test(error?.message || "")) {
    return "Inicia sesión para hablar conmigo.";
  }
  if (error?.status === 401 || error?.status === 403) {
    return "No pude conectar con Gemini. Hay que crear una clave nueva en Google AI Studio.";
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
