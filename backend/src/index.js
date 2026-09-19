import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth } from "./auth.js";
import { getProfile, saveProfile } from "./profile.js";
import { geminiTurn, publicGeminiError } from "./gemini.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  res.setHeader("Permissions-Policy", "microphone=(self)");
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "vita-backend" });
});

app.get("/api/config", (_req, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID,
      measurementId: process.env.FIREBASE_MEASUREMENT_ID
    }
  });
});

app.get("/api/profile", requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization.slice(7);
    const profile = await getProfile(req.user.uid, token);
    res.json({ profile });
  } catch (error) {
    res.status(error.status || 500).json({
      error: "No se pudo leer tu perfil. Revisa que Firestore esté creado y las reglas publicadas."
    });
  }
});

app.put("/api/profile", requireAuth, async (req, res) => {
  try {
    const { nombre, telefono, rol } = req.body || {};
    if (!nombre?.trim() || !telefono?.trim() || !rol) {
      res.status(400).json({ error: "Completa nombre, teléfono y rol." });
      return;
    }
    if (rol !== "paciente" && rol !== "enfermero") {
      res.status(400).json({ error: "El rol debe ser paciente o enfermero." });
      return;
    }
    const token = req.headers.authorization.slice(7);
    const profile = await saveProfile(req.user, {
      nombre: String(nombre).trim(),
      telefono: String(telefono).trim(),
      rol
    }, token);
    res.json({ profile });
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || "No se pudo guardar el perfil."
    });
  }
});

app.post("/api/chat/turn", requireAuth, async (req, res) => {
  try {
    const { contents, snapshot, profile } = req.body || {};
    if (!Array.isArray(contents) || !contents.length) {
      res.status(400).json({ error: "Falta el mensaje." });
      return;
    }
    const result = await geminiTurn({
      contents,
      snapshot: snapshot || {},
      profile: profile || {}
    });
    res.json(result);
  } catch (error) {
    res.status(error.status || 500).json({
      error: publicGeminiError(error),
      status: error.status || 500
    });
  }
});

app.use(express.static(rootDir));

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }
  if (req.path.startsWith("/api/")) {
    next();
    return;
  }
  const rel = decodeURIComponent(req.path === "/" ? "index.html" : req.path.replace(/^\/+/, ""));
  if (!rel || rel.includes("..")) {
    next();
    return;
  }
  const file = path.join(rootDir, rel);
  if (file.startsWith(rootDir) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    res.sendFile(file);
    return;
  }
  res.sendFile(path.join(rootDir, "index.html"));
});

app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({ error: "No encontrado." });
    return;
  }
  res.sendFile(path.join(rootDir, "index.html"));
});

export default app;

if (!process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`Vita lista en http://localhost:${port}`);
  });
}
