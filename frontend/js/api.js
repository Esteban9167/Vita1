import { auth } from "./firebase.js";
import { runVitaTool, buildSnapshot } from "./vita-tools.js";

let chatHistory = [];

async function authHeaders() {
  const user = auth.currentUser;
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error("Inicia sesión."), { status: 401 });
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Error ${response.status}`);
    error.status = data.status || response.status;
    throw error;
  }
  return data;
}

export function resetVitaChat() {
  chatHistory = [];
}

export function geminiErrorMessage(error) {
  if (error?.status === 401 || error?.status === 403) {
    return error.message || "No pude conectar con el servidor. Inicia sesión otra vez.";
  }
  if (error?.status === 429) {
    return "Estoy un poco ocupada ahora. Inténtalo en un momento.";
  }
  return "";
}

async function chatTurn(contents, snapshot, profile) {
  return api("/api/chat/turn", {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({ contents, snapshot, profile })
  });
}

export async function askVita(text, { vita, profile, onDataChanged } = {}) {
  const snapshot = buildSnapshot(vita);
  const contents = chatHistory.map((item) => ({
    role: item.role,
    parts: [{ text: item.text }]
  }));
  contents.push({ role: "user", parts: [{ text }] });

  let dataChanged = false;
  let payload = await chatTurn(contents, snapshot, profile);

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
    payload = await chatTurn(contents, buildSnapshot(vita), profile);
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
