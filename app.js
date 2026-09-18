import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile,
  browserPopupRedirectResolver
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { auth, db, googleProvider, appleProvider } from "./firebase.js?v=care12";
import { askVita, resetVitaChat, geminiErrorMessage } from "./gemini.js?v=care12";

const vita = window.vita;
const VITA_PIN = "1234";
const CONTACT_COLORS = ["#1F6F6B", "#FF6F52", "#7C6FBA", "#F2AE3C", "#3E8E7E"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DOWS = ["L", "M", "X", "J", "V", "S", "D"];

const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c1-4 3.6-6 6.5-6s5.5 2 6.5 6"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15.7 14c2.4.3 4.3 2.1 5 4.6"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="10.2" width="18" height="7.6" rx="3.8" transform="rotate(-45 12 12)"/><line x1="12" y1="6" x2="12" y2="18" transform="rotate(-45 12 12)"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21M9 21h6"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 5 8 12l6.5 7"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 5 16 12l-6.5 7"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 3 3 10.5l7 3 3 7z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h4l2 5-2.5 1.5a12 12 0 0 0 6 6L15 14l5 2v4a2 2 0 0 1-2 2C9.5 22 2 14.5 2 6a2 2 0 0 1 2-2z"/></svg>',
  msg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.5 9 9 0 0 1-3.6-.7L3 21l1.8-5A8.4 8.4 0 1 1 21 11.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V7l8-4 8 4v12"/><path d="M9 19v-6h6v6"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>'
};

const NAV = [
  { id: "inicio", label: "Inicio", icon: "home" },
  { id: "historia", label: "Historia clínica", icon: "file" },
  { id: "contactos", label: "Contactos", icon: "users" },
  { id: "medicamentos", label: "Medicamentos", icon: "pill" },
  { id: "calendario", label: "Calendario", icon: "cal" }
];

let currentUser = null;
let currentProfile = null;
let selectedRegRole = "";
let authBusy = false;
let selectedProfileRole = "";
let vitaLocked = false;
let vitaBusy = false;
let pinMode = "activate";
let toastTimer;
let remoteSaveTimer;
let activePatientUid = null;
let patientRoster = [];
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function carePayload(state) {
  return JSON.parse(JSON.stringify({
    patientName: state.patientName || "",
    historia: state.historia || {},
    orientacion: state.orientacion || {},
    contactos: state.contactos || [],
    medicamentos: state.medicamentos || [],
    eventos: state.eventos || {},
    nextMedId: state.nextMedId || 1
  }));
}

function remoteCarePresent(vitaData) {
  if (!vitaData || typeof vitaData !== "object") return false;
  const h = vitaData.historia || {};
  const o = vitaData.orientacion || {};
  return !!(
    h.sangre || h.alergias || h.cronicas || h.cirugias || h.notas
    || o.lugar || o.acompanante || o.presentacion
    || vitaData.contactos?.length
    || vitaData.medicamentos?.length
    || (vitaData.eventos && Object.keys(vitaData.eventos).length)
  );
}

function careDocUid() {
  if (isNurse() && activePatientUid) return activePatientUid;
  if (isNurse()) return null;
  return auth.currentUser?.uid || null;
}

async function persistCareData(state) {
  const uid = careDocUid();
  if (!uid || !state) return;
  const user = auth.currentUser;
  if (!user) return;
  try {
    const payload = carePayload(state);
    await setDoc(doc(db, "usuarios", uid), {
      vita: payload,
      resumen: {
        alergias: payload.historia?.alergias || "",
        medicamentos: (payload.medicamentos || []).length,
        contactos: (payload.contactos || []).length
      },
      actualizadoEn: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error("No se pudo guardar en Firebase:", error);
  }
}

function queueRemoteSave(state) {
  clearTimeout(remoteSaveTimer);
  remoteSaveTimer = setTimeout(() => persistCareData(state), 400);
}

function hydrateVita(user, profile) {
  vita.switchProfile(user.uid);
  if (remoteCarePresent(profile?.vita)) {
    vita.applyState(profile.vita);
  } else if (vita.hasCareData()) {
    persistCareData(vita.getState());
  }
}

function normalizeAccessCode(raw) {
  return String(raw || "").toUpperCase().replace(/[01IO]/g, "").replace(/[^A-Z0-9]/g, "");
}

function formatAccessCode(raw) {
  const compact = normalizeAccessCode(raw);
  if (compact.length === 8) return `${compact.slice(0, 4)}-${compact.slice(4)}`;
  return compact;
}

function randomAccessCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

function renderAccessCodeCard() {
  const card = $("accessCodeCard");
  if (!card) return;
  const code = currentProfile?.codigoAcceso;
  const show = !isNurse() && currentProfile?.rol === "paciente" && !!code;
  card.hidden = !show;
  if (show) $("patientAccessCode").textContent = formatAccessCode(code);
}

async function copyPatientCode() {
  const code = formatAccessCode(currentProfile?.codigoAcceso);
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    showToast("Código copiado");
  } catch {
    showToast("Copia este código: " + code);
  }
}

async function ensurePatientCode(user, profile) {
  if (!user || profile?.rol !== "paciente") return profile;
  const payload = {
    patientUid: user.uid,
    nombre: profile.nombre || "",
    email: profile.email || ""
  };
  let code = normalizeAccessCode(profile.codigoAcceso);
  if (code) {
    try {
      await setDoc(doc(db, "codigos", code), { ...payload, creadoEn: serverTimestamp() }, { merge: true });
    } catch (error) {
      console.error(error);
      code = "";
    }
  }
  if (!code) {
    for (let i = 0; i < 8; i += 1) {
      const candidate = randomAccessCode();
      try {
        await setDoc(doc(db, "codigos", candidate), { ...payload, creadoEn: serverTimestamp() });
        code = candidate;
        break;
      } catch (error) {
        console.error(error);
      }
    }
  }
  if (code) {
    profile.codigoAcceso = code;
    writeLocalProfile(user.uid, profile);
    try {
      await setDoc(doc(db, "usuarios", user.uid), { codigoAcceso: code }, { merge: true });
    } catch (error) {
      console.error(error);
    }
  }
  return profile;
}

async function loadPatientRoster() {
  const list = $("patientRoster");
  if (!list || !isNurse()) return;
  const nurseId = auth.currentUser?.uid;
  if (!nurseId) return;
  list.innerHTML = emptyState("Cargando pacientes...");
  try {
    const snap = await getDocs(collection(db, "usuarios", nurseId, "pacientes"));
    const rows = await Promise.all(snap.docs.map(async (item) => {
      const linked = { uid: item.data().patientUid || item.id, codigoAcceso: item.id, ...item.data() };
      if (!linked.uid) return null;
      try {
        const full = await getDoc(doc(db, "usuarios", linked.uid));
        if (full.exists()) return { uid: linked.uid, codigoAcceso: item.id, ...full.data() };
      } catch (error) {
        console.error(error);
      }
      return linked;
    }));
    patientRoster = rows.filter(Boolean);
    renderPatientRoster();
  } catch (error) {
    console.error(error);
    list.innerHTML = emptyState("No pude leer tus pacientes. En Firebase, publica las reglas de Firestore de esta carpeta.");
  }
}

function renderPatientRoster() {
  const list = $("patientRoster");
  if (!list) return;
  const q = ($("patientSearch")?.value || "").trim().toLowerCase();
  const rows = patientRoster.filter((patient) => {
    if (!q) return true;
    const blob = `${patient.nombre || ""} ${patient.email || ""} ${patient.telefono || ""}`.toLowerCase();
    return blob.includes(q);
  });
  if (!rows.length) {
    list.innerHTML = emptyState(q
      ? "Ningún paciente a tu cargo coincide con esa búsqueda."
      : "Aún no tienes pacientes. Pídeles su código de Vita y escríbelo arriba para vincularlos.");
    return;
  }
  list.innerHTML = rows.map((patient) => {
    const historia = patient.vita?.historia || {};
    const meds = patient.vita?.medicamentos || [];
    return `
      <button class="patient-card" type="button" data-open-patient="${escapeHtml(patient.uid)}">
        <div>
          <div class="who">${escapeHtml(patient.nombre || "Paciente")}</div>
          <div class="mail">${escapeHtml(patient.email || patient.telefono || "Vinculado con código")}</div>
        </div>
        <dl>
          <div>
            <dt>Alergias</dt>
            <dd>${escapeHtml(historia.alergias || "Sin registrar")}</dd>
          </div>
          <div>
            <dt>Medicamentos</dt>
            <dd>${meds.length ? meds.length + " registrados" : "Ninguno aún"}</dd>
          </div>
        </dl>
        <span class="open-label">Abrir expediente</span>
      </button>
    `;
  }).join("");
}

async function openPatient(uid) {
  let patient = patientRoster.find((item) => item.uid === uid);
  if (!patient) {
    try {
      const snap = await getDoc(doc(db, "usuarios", uid));
      if (!snap.exists()) return showToast("No encontré a ese paciente.");
      patient = { uid, ...snap.data() };
      patientRoster.push(patient);
    } catch {
      return showToast("No pude abrir ese expediente. Solo puedes ver pacientes vinculados con su código.");
    }
  }
  activePatientUid = uid;
  vita.switchProfile(uid);
  if (remoteCarePresent(patient.vita)) vita.applyState(patient.vita);
  vita.setPatientName(patient.nombre || patient.vita?.patientName || "Paciente");
  vita.setHistoriaLocked(false);
  renderAll();
  goTo("inicio");
  showToast("Expediente de " + (patient.nombre || "paciente"));
}

async function linkPatientByCode() {
  const code = normalizeAccessCode($("linkPatientCode")?.value);
  if (code.length !== 8) return showToast("Escribe el código de 8 caracteres del paciente.");
  const nurseId = auth.currentUser?.uid;
  if (!nurseId) return;
  try {
    const codeSnap = await getDoc(doc(db, "codigos", code));
    if (!codeSnap.exists()) {
      showToast("Ese código no existe. Pídeselo otra vez al paciente.");
      return;
    }
    const patientUid = codeSnap.data().patientUid;
    if (!patientUid) {
      showToast("Ese código no es válido.");
      return;
    }
    if (patientRoster.some((item) => item.uid === patientUid)) {
      $("linkPatientCode").value = "";
      showToast("Ese paciente ya está a tu cargo.");
      return;
    }
    const preview = {
      uid: patientUid,
      nombre: codeSnap.data().nombre || "Paciente",
      email: codeSnap.data().email || "",
      codigoAcceso: code
    };
    await setDoc(doc(db, "usuarios", nurseId, "pacientes", code), {
      ...preview,
      vinculadoEn: serverTimestamp()
    });
    await setDoc(doc(db, "usuarios", patientUid, "responsables", nurseId), {
      uid: nurseId,
      nombre: currentProfile?.nombre || "",
      email: currentProfile?.email || "",
      vinculadoEn: serverTimestamp()
    });
    $("linkPatientCode").value = "";
    showToast("Paciente vinculado a tu cargo");
    await loadPatientRoster();
  } catch (error) {
    console.error(error);
    showToast("No pude vincular al paciente. Publica las reglas de Firestore e inténtalo de nuevo.");
  }
}
const today = new Date();
let calYear = today.getFullYear();
let calMonth = today.getMonth();
let selectedDateKey = vita.formatearFecha(today);

function $(id) { return document.getElementById(id); }

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isNurse() {
  return currentProfile?.rol === "enfermero";
}

function requireOpenPatient() {
  if (!isNurse()) return true;
  if (activePatientUid) return true;
  showToast("Elige un paciente para abrir su expediente.");
  goTo("pacientes");
  return false;
}

function roleLabel(rol) {
  return rol === "enfermero" ? "Enfermero" : "Paciente";
}

function firebaseAuthMessage(error) {
  const map = {
    "auth/email-already-in-use": "Ya existe una cuenta con ese correo.",
    "auth/invalid-email": "Ingresa un correo válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "No encontramos esa cuenta.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/popup-closed-by-user": "Se cerró la ventana de Google. Inténtalo de nuevo y deja la ventana abierta hasta terminar.",
    "auth/cancelled-popup-request": "Se canceló el inicio de sesión. Pulsa Google otra vez.",
    "auth/operation-not-allowed": "Google no está activo en Firebase Authentication.",
    "auth/unauthorized-domain": `Firebase no autorizó ${location.hostname}. En Authentication > Settings > Authorized domains debe estar exactamente "localhost", sin http ni puerto.`,
    "auth/account-exists-with-different-credential": "Ese correo ya está registrado con otro método. Entra con correo y contraseña.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio.",
    "auth/network-request-failed": "Revisa tu conexión e inténtalo de nuevo.",
    "auth/internal-error": "Google no pudo completar el acceso. Recarga la página e inténtalo otra vez.",
    "auth/redirect-cancelled-by-user": "Cancelaste el acceso con Google.",
    "auth/missing-or-invalid-nonce": "No se pudo validar el acceso con Google. Inténtalo de nuevo."
  };
  return map[error?.code] || error?.message || "No se pudo completar el acceso.";
}

function showAuthPanel(id) {
  $("loginForm").style.display = id === "loginForm" ? "block" : "none";
  $("registerForm").style.display = id === "registerForm" ? "block" : "none";
  $("profileForm").style.display = id === "profileForm" ? "block" : "none";
  $("healthForm").style.display = id === "healthForm" ? "block" : "none";
  hideAuthErrors();
}

function selectRole(pickerId, role, store) {
  document.querySelectorAll(`#${pickerId} .role-card`).forEach((card) => {
    card.classList.toggle("selected", card.dataset.role === role);
  });
  if (store === "reg") selectedRegRole = role;
  if (store === "profile") selectedProfileRole = role;
}

function localProfileKey(uid) {
  return `vita_profile_${uid}`;
}

function readLocalProfile(uid) {
  try {
    const raw = localStorage.getItem(localProfileKey(uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalProfile(uid, profile) {
  localStorage.setItem(localProfileKey(uid), JSON.stringify(profile));
}

async function getProfile() {
  const uid = auth.currentUser?.uid;
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, "usuarios", uid));
    if (snap.exists()) {
      writeLocalProfile(uid, snap.data());
      return snap.data();
    }
  } catch (error) {
    const cached = readLocalProfile(uid);
    if (cached) return cached;
    throw error;
  }
  return readLocalProfile(uid);
}

function profileComplete(profile) {
  return !!(profile?.nombre && profile?.telefono && profile?.rol);
}

async function saveProfile(user, data) {
  const existing = readLocalProfile(user.uid) || currentProfile || {};
  const profile = {
    uid: user.uid,
    email: user.email || "",
    nombre: data.nombre,
    telefono: data.telefono,
    rol: data.rol
  };
  if (data.rol === "paciente" && existing.codigoAcceso) {
    profile.codigoAcceso = existing.codigoAcceso;
  }
  writeLocalProfile(user.uid, profile);
  try {
    await setDoc(doc(db, "usuarios", user.uid), {
      ...profile,
      actualizadoEn: serverTimestamp()
    }, { merge: true });
    if (profile.rol === "paciente") {
      await ensurePatientCode(user, profile);
    }
  } catch {
    // Si Firestore no está listo, el perfil local alcanza para entrar.
  }
  return profile;
}

function showAuthScreen() {
  currentUser = null;
  currentProfile = null;
  activePatientUid = null;
  patientRoster = [];
  if (vitaLocked) deactivateVita();
  resetVitaChat();
  if ($("transcriptBox")) $("transcriptBox").innerHTML = "";
  $("app-container").classList.remove("active");
  $("auth-screen").style.display = "grid";
  showAuthPanel("loginForm");
}

function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2200);
}

function emptyState(msg) {
  return `<div class="empty-state">${ICONS.empty}<p>${escapeHtml(msg)}</p></div>`;
}

function showLogin() {
  showAuthPanel("loginForm");
}

function showRegister() {
  showAuthPanel("registerForm");
}

function hideAuthErrors() {
  ["loginError", "registerError", "profileError", "healthError"].forEach((id) => {
    const el = $(id);
    if (el) el.classList.remove("show");
  });
}

function showAuthError(id, msg) {
  const el = $(id);
  el.textContent = msg;
  el.classList.add("show");
}

async function doRegister() {
  const nombre = $("regNombre").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const telefono = $("regTelefono").value.trim();
  const pass = $("regPassword").value;
  const pass2 = $("regPassword2").value;
  const terms = $("regTerms").checked;

  if (!nombre || !email || !telefono || !pass || !pass2) {
    return showAuthError("registerError", "Completa todos los campos.");
  }
  if (!selectedRegRole) return showAuthError("registerError", "Elige si eres paciente o enfermero.");
  if (!email.includes("@") || !email.includes(".")) return showAuthError("registerError", "Ingresa un correo válido.");
  if (telefono.replace(/\D/g, "").length < 7) return showAuthError("registerError", "Ingresa un número de teléfono válido.");
  if (pass.length < 6) return showAuthError("registerError", "La contraseña debe tener al menos 6 caracteres.");
  if (pass !== pass2) return showAuthError("registerError", "Las contraseñas no coinciden.");
  if (!terms) return showAuthError("registerError", "Debes aceptar el uso de tus datos para continuar.");

  authBusy = true;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: nombre });
    await saveProfile(cred.user, {
      nombre,
      telefono,
      rol: selectedRegRole
    });
    await handleAuthenticatedUser(cred.user);
  } catch (error) {
    showAuthError("registerError", firebaseAuthMessage(error));
  } finally {
    authBusy = false;
  }
}

async function doLogin() {
  const email = $("loginEmail").value.trim().toLowerCase();
  const pass = $("loginPassword").value;

  if (!email || !pass) return showAuthError("loginError", "Ingresa tu correo y contraseña.");
  if (!email.includes("@") || !email.includes(".")) return showAuthError("loginError", "Ingresa un correo válido.");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (error) {
    showAuthError("loginError", firebaseAuthMessage(error));
  }
}

async function socialLogin(providerName) {
  if (authBusy) return;
  const provider = providerName === "apple" ? appleProvider : googleProvider;
  const errorId = $("registerForm").style.display === "block" ? "registerError" : "loginError";
  hideAuthErrors();
  sessionStorage.setItem("vita_social", providerName);
  showAuthError(errorId, providerName === "apple"
    ? "Abriendo Apple..."
    : "Abriendo Google...");
  authBusy = true;
  try {
    const result = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
    hideAuthErrors();
    sessionStorage.removeItem("vita_social");
    await handleAuthenticatedUser(result.user);
  } catch (popupError) {
    if (popupError?.code === "auth/cancelled-popup-request") return;
    if (popupError?.code === "auth/popup-blocked") {
      await signInWithRedirect(auth, provider);
      return;
    }
    sessionStorage.removeItem("vita_social");
    if (providerName === "apple") {
      showAuthError(errorId, "Apple no pudo completar el acceso en este equipo. Entra con Google o con correo.");
      return;
    }
    showAuthError(errorId, firebaseAuthMessage(popupError));
  } finally {
    authBusy = false;
  }
}

function showHealthGate(user, profile = null) {
  $("auth-screen").style.display = "grid";
  $("app-container").classList.remove("active");
  hydrateVita(user, profile);
  vita.setPatientName(profile?.nombre || user.displayName || "");
  vita.setHistoriaLocked(false);
  const h = vita.obtenerHistoria();
  const o = vita.state.orientacion || {};
  $("hfSangre").value = h.sangre || "";
  $("hfAlergias").value = h.alergias || "";
  $("hfCronicas").value = h.cronicas || "";
  $("hfCirugias").value = h.cirugias || "";
  $("hfNotas").value = h.notas || "";
  $("hfLugar").value = o.lugar || "";
  $("hfAcompanante").value = o.acompanante || "";
  $("hfPresentacion").value = o.presentacion || "";
  currentProfile = profile;
  showAuthPanel("healthForm");
}

function readHealthForm() {
  return {
    sangre: $("hfSangre").value.trim(),
    alergias: $("hfAlergias").value.trim(),
    cronicas: $("hfCronicas").value.trim(),
    cirugias: $("hfCirugias").value.trim(),
    notas: $("hfNotas").value.trim(),
    lugar: $("hfLugar").value.trim(),
    acompanante: $("hfAcompanante").value.trim(),
    presentacion: $("hfPresentacion").value.trim()
  };
}

function saveHealthAndEnter() {
  const user = auth.currentUser;
  if (!user) return;
  const data = readHealthForm();
  if (!data.sangre || !data.alergias || !data.cronicas || !data.cirugias || !data.notas || !data.lugar || !data.acompanante || !data.presentacion) {
    return showAuthError("healthError", "Completa la historia clínica y los datos para orientar con calma. Si algo no aplica, escribe Ninguna.");
  }
  vita.switchProfile(user.uid);
  vita.setHistoriaLocked(false);
  vita.setPatientName(currentProfile?.nombre || user.displayName || "");
  vita.guardarHistoria(data);
  vita.guardarOrientacion(data);
  vita.setHistoriaLocked(true);
  persistCareData(vita.getState());
  enterApp(user, currentProfile);
}

function showProfileGate(user, profile = null) {
  $("auth-screen").style.display = "grid";
  $("app-container").classList.remove("active");
  showAuthPanel("profileForm");
  $("profileNombre").value = profile?.nombre || user.displayName || "";
  $("profileTelefono").value = profile?.telefono || "";
  selectedProfileRole = profile?.rol || "";
  document.querySelectorAll("#profileRolePicker .role-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.role === selectedProfileRole);
  });
}

async function saveProfileAndEnter() {
  const user = auth.currentUser;
  if (!user) return;
  const nombre = $("profileNombre").value.trim();
  const telefono = $("profileTelefono").value.trim();
  if (!nombre || !telefono) return showAuthError("profileError", "Completa nombre y teléfono.");
  if (!selectedProfileRole) return showAuthError("profileError", "Elige si eres paciente o enfermero.");
  if (telefono.replace(/\D/g, "").length < 7) return showAuthError("profileError", "Ingresa un número de teléfono válido.");

  authBusy = true;
  try {
    await updateProfile(user, { displayName: nombre });
    await saveProfile(user, { nombre, telefono, rol: selectedProfileRole });
    await handleAuthenticatedUser(user);
  } catch (error) {
    showAuthError("profileError", firebaseAuthMessage(error));
  } finally {
    authBusy = false;
  }
}

async function handleAuthenticatedUser(user) {
  if (!user) {
    showAuthScreen();
    return;
  }
  try {
    const profile = await getProfile();
    if (!profileComplete(profile)) {
      showProfileGate(user, profile);
      return;
    }
    if (profile.rol === "paciente") {
      hydrateVita(user, profile);
      if (!vita.fichaClinicaCompleta()) {
        showHealthGate(user, profile);
        return;
      }
    }
    enterApp(user, profile);
  } catch (error) {
    const cached = readLocalProfile(user.uid);
    if (profileComplete(cached)) {
      if (cached.rol === "paciente") {
        hydrateVita(user, cached);
        if (!vita.fichaClinicaCompleta()) {
          showHealthGate(user, cached);
          return;
        }
      }
      enterApp(user, cached);
      return;
    }
    showProfileGate(user, cached);
    showAuthError("profileError", "Entra con tus datos básicos. Si Firestore no está listo, igual puedes usar Vita.");
  }
}

function enterApp(user, profile) {
  if ($("app-container").classList.contains("active") && currentUser === user.uid) return;
  currentUser = user.uid;
  currentProfile = profile;
  activePatientUid = null;
  resetVitaChat();
  const nombre = profile.nombre || user.displayName || "Usuario";
  if (profile.rol === "enfermero") {
    vita.switchProfile(user.uid);
    vita.setHistoriaLocked(false);
    vita.setPatientName(nombre);
  } else {
    hydrateVita(user, profile);
    vita.setHistoriaLocked(true);
    vita.setPatientName(nombre);
    ensurePatientCode(user, profile).then((updated) => {
      currentProfile = updated;
      renderAccessCodeCard();
    }).catch((error) => console.error(error));
  }
  seedAssistant();
  $("auth-screen").style.display = "none";
  $("profileForm").style.display = "none";
  $("healthForm").style.display = "none";
  $("app-container").classList.add("active");
  $("sidebarEmail").textContent = roleLabel(profile.rol);
  renderNav();
  renderAll();
  goTo(isNurse() ? "pacientes" : "inicio");
  if (isNurse()) loadPatientRoster();
}

async function doLogout() {
  if (vitaLocked) return;
  await signOut(auth);
  showToast("Sesión cerrada");
}

function goTo(name) {
  if (vitaLocked) return;
  if (isNurse() && name !== "pacientes" && !activePatientUid) {
    showToast("Elige un paciente para ver su expediente.");
    name = "pacientes";
  }
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
  document.querySelectorAll(".side-link").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "calendario") renderCalendar();
  if (name === "pacientes") loadPatientRoster();
}

function navItems() {
  if (!isNurse()) return NAV;
  return [
    { id: "pacientes", label: "Pacientes", icon: "users" },
    { id: "inicio", label: "Expediente", icon: "home" },
    { id: "historia", label: "Historia clínica", icon: "file" },
    { id: "contactos", label: "Contactos", icon: "users" },
    { id: "medicamentos", label: "Medicamentos", icon: "pill" },
    { id: "calendario", label: "Calendario", icon: "cal" }
  ];
}

function renderNav() {
  const items = navItems();
  const first = items[0]?.id;
  $("side-nav").innerHTML = items.map((item) => `
    <button class="side-link ${item.id === first ? "active" : ""}" type="button" data-nav="${item.id}">
      ${ICONS[item.icon]}<span>${item.label}</span>
    </button>
  `).join("");

  $("quick-grid").innerHTML = `
    <button class="quick-tile" type="button" data-nav="historia">
      <div class="icon-wrap tint-teal">${ICONS.file}</div>
      <span class="label">Historia clínica</span>
      <span class="meta">Ver y editar</span>
    </button>
    <button class="quick-tile" type="button" data-nav="contactos">
      <div class="icon-wrap tint-coral">${ICONS.users}</div>
      <span class="label">Contactos</span>
      <span class="meta" id="contactCountMeta">0 de emergencia</span>
    </button>
    <button class="quick-tile" type="button" data-nav="medicamentos">
      <div class="icon-wrap tint-gold">${ICONS.pill}</div>
      <span class="label">Medicamentos</span>
      <span class="meta" id="medCountMeta">0 activos</span>
    </button>
    <button class="quick-tile" type="button" data-nav="calendario">
      <div class="icon-wrap tint-lav">${ICONS.cal}</div>
      <span class="label">Calendario</span>
      <span class="meta">Citas y eventos</span>
    </button>
  `;
}

function renderHeader() {
  const h = today.getHours();
  const nurseName = currentProfile?.nombre || "";
  const name = isNurse() ? nurseName : vita.getPatientName();
  $("greeting-time").textContent = h < 12 ? "Buenos días" : (h < 19 ? "Buenas tardes" : "Buenas noches");
  $("greeting-name").textContent = (name || "Vita").split(" ")[0];
  $("avatarBadge").textContent = (name || "V")[0];
  $("sidebarName").textContent = name || "Vita";
  const opts = { weekday: "long", day: "numeric", month: "long" };
  const label = today.toLocaleDateString("es-ES", opts);
  $("today-label").textContent = isNurse() && activePatientUid
    ? `Expediente de ${vita.getPatientName()}`
    : (label.charAt(0).toUpperCase() + label.slice(1));
  renderCareBanner();
}

function renderCareBanner() {
  const banner = $("careBanner");
  if (!banner) return;
  const show = isNurse() && !!activePatientUid;
  banner.hidden = !show;
  if (!show) return;
  $("careBannerName").textContent = vita.getPatientName() || "Paciente";
  $("careBannerMeta").textContent = "Historia, medicamentos y citas de esta persona";
}

function loadHistoriaForm() {
  const h = vita.obtenerHistoria();
  $("hcSangre").value = h.sangre;
  $("hcAlergias").value = h.alergias;
  $("hcCronicas").value = h.cronicas;
  $("hcCirugias").value = h.cirugias;
  $("hcNotas").value = h.notas;
  const o = vita.state.orientacion || {};
  $("orLugar").value = o.lugar || "";
  $("orAcompanante").value = o.acompanante || "";
  $("orPresentacion").value = o.presentacion || "";
  applyHistoriaPermissions();
}

function applyHistoriaPermissions() {
  const locked = !isNurse();
  vita.setHistoriaLocked(locked);
  ["hcSangre", "hcAlergias", "hcCronicas", "hcCirugias", "hcNotas", "orLugar", "orAcompanante", "orPresentacion"].forEach((id) => {
    const el = $(id);
    el.readOnly = locked;
    el.disabled = locked;
    el.classList.toggle("is-readonly", locked);
    el.setAttribute("aria-readonly", locked ? "true" : "false");
  });
  $("btn-save-historia").hidden = locked;
  $("btn-save-historia").disabled = locked;
  $("btn-save-orientacion").hidden = locked;
  $("btn-save-orientacion").disabled = locked;
  $("historiaLockNote").hidden = !locked;
  $("orientacionLockNote").hidden = !locked;
}

function saveOrientacion() {
  if (!requireOpenPatient()) return;
  if (!isNurse()) {
    showToast("Solo un enfermero puede actualizar estos datos.");
    return;
  }
  vita.guardarOrientacion({
    lugar: $("orLugar").value,
    acompanante: $("orAcompanante").value,
    presentacion: $("orPresentacion").value
  });
  showToast("Datos de orientación guardados");
}

function saveHistoria() {
  if (!requireOpenPatient()) return;
  if (!isNurse()) {
    showToast("Solo un enfermero puede modificar la historia clínica.");
    return;
  }
  vita.setPatientName(vita.getPatientName());
  vita.guardarHistoria({
    sangre: $("hcSangre").value,
    alergias: $("hcAlergias").value,
    cronicas: $("hcCronicas").value,
    cirugias: $("hcCirugias").value,
    notas: $("hcNotas").value
  });
  showToast("Historia clínica guardada");
}

function renderContacts() {
  const contacts = vita.obtenerContactos();
  const card = $("contactsCard");
  const meta = $("contactCountMeta");
  if (meta) meta.textContent = contacts.length + " de emergencia";

  if (!contacts.length) {
    card.innerHTML = emptyState("Aún no tienes contactos de emergencia guardados.");
    return;
  }

  card.innerHTML = contacts.map((c, i) => `
    <div class="contact-card">
      <div class="contact-avatar" style="background:${CONTACT_COLORS[i % CONTACT_COLORS.length]}">${escapeHtml(c.nombre[0] || "?")}</div>
      <div class="grow">
        <div class="contact-name">${escapeHtml(c.nombre)}</div>
        <div class="contact-rel">${escapeHtml(c.relacion)} · ${escapeHtml(c.telefono)}</div>
      </div>
      <div class="contact-actions">
        <button class="icon-btn" type="button" data-call="${c.id}" aria-label="Llamar">${ICONS.phone}</button>
        <button class="icon-btn" type="button" data-sms="${c.id}" aria-label="Mensaje">${ICONS.msg}</button>
      </div>
    </div>
  `).join("");
}

function addContact() {
  if (!requireOpenPatient()) return;
  try {
    vita.agregarContacto({
      nombre: $("mcNombre").value,
      relacion: $("mcRelacion").value,
      telefono: $("mcTelefono").value
    });
    ["mcNombre", "mcRelacion", "mcTelefono"].forEach((id) => $(id).value = "");
    renderContacts();
    showToast("Contacto agregado");
  } catch (error) {
    showToast(error.message || "Completa nombre y teléfono");
  }
}

function renderMeds() {
  const meds = vita.obtenerMedicamentos();
  const card = $("medsCard");
  const meta = $("medCountMeta");
  if (meta) meta.textContent = meds.length + " activos";

  if (!meds.length) {
    card.innerHTML = emptyState("No tienes medicamentos registrados todavía.");
  } else {
    card.innerHTML = meds.map((m) => `
      <div class="med-list-row">
        <div class="grow">
          <div class="med-info">
            <div class="name">${escapeHtml(m.nombre)}</div>
            <div class="meta">${escapeHtml(m.dosis)} · ${escapeHtml(m.horarios.join(" · "))}</div>
          </div>
        </div>
        <button class="icon-btn" type="button" data-del-med="${m.id}" aria-label="Eliminar">${ICONS.trash}</button>
      </div>
    `).join("");
  }
  renderHomeMeds();
}

function addMed() {
  if (!requireOpenPatient()) return;
  try {
    vita.agregarMedicamento({
      nombre: $("mmNombre").value,
      dosis: $("mmDosis").value,
      horarios: $("mmHorarios").value,
      hora: $("mmHorarios").value
    });
    ["mmNombre", "mmDosis", "mmHorarios"].forEach((id) => $(id).value = "");
    renderMeds();
    renderHero();
    showToast("Medicamento agregado");
  } catch (error) {
    showToast(error.message || "Completa nombre y un horario, por ejemplo 08:00");
  }
}

function renderHomeMeds() {
  const list = $("homeMedList");
  const slots = vita.medicamentosDeHoy();
  if (!slots.length) {
    list.innerHTML = emptyState("No tienes medicamentos programados para hoy.");
    $("medProgress").textContent = "0/0";
    return;
  }

  list.innerHTML = slots.map((s) => `
    <div class="med-row">
      <button class="check-circle ${s.tomado ? "done" : ""}" type="button" data-toggle-med="${s.id}" data-hora="${escapeHtml(s.hora)}" aria-label="Marcar tomado">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>
      </button>
      <div class="med-info">
        <div class="name ${s.tomado ? "done" : ""}">${escapeHtml(s.nombre)} · ${escapeHtml(s.dosis)}</div>
        <div class="meta">Hora programada</div>
      </div>
      <span class="time-pill">${escapeHtml(s.hora)}</span>
    </div>
  `).join("");

  $("medProgress").textContent = slots.filter((s) => s.tomado).length + "/" + slots.length;
}

function renderHero() {
  const next = vita.obtenerProximoEvento();
  if (!next) {
    $("heroTitle").textContent = "Sin eventos programados";
    $("heroWhen").textContent = "Agrega uno desde el calendario";
    return;
  }
  const dLabel = next.fechaHora.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  $("heroTitle").textContent = next.titulo;
  $("heroWhen").textContent = dLabel.charAt(0).toUpperCase() + dLabel.slice(1) + " · " + next.hora;
}

function shiftMonth(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear -= 1; }
  if (calMonth > 11) { calMonth = 0; calYear += 1; }
  renderCalendar();
}

function renderCalendar() {
  $("monthLabel").textContent = MESES[calMonth] + " " + calYear;
  const grid = $("calGrid");
  let html = DOWS.map((d) => `<div class="cal-dow">${d}</div>`).join("");
  const first = new Date(calYear, calMonth, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayKey = vita.formatearFecha(today);

  for (let i = 0; i < startOffset; i += 1) html += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = vita.formatearFecha(new Date(calYear, calMonth, day));
    const classes = [
      "cal-cell",
      key === todayKey ? "today" : "",
      key === selectedDateKey ? "selected" : ""
    ].join(" ");
    const hasEvents = vita.obtenerEventos(key).length > 0;
    html += `<button class="${classes}" type="button" data-date="${key}">${day}${hasEvents ? '<span class="dot"></span>' : ""}</button>`;
  }
  grid.innerHTML = html;
  renderDayEvents();
}

function renderDayEvents() {
  const d = new Date(selectedDateKey + "T00:00:00");
  const label = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  $("dayEventsLabel").textContent = label.charAt(0).toUpperCase() + label.slice(1);
  const evs = vita.obtenerEventos(selectedDateKey);
  const list = $("dayEventsList");
  if (!evs.length) {
    list.innerHTML = emptyState("No hay eventos este día.");
    return;
  }
  const tipoLabel = { cita: "Cita médica", medicamento: "Medicamento", otro: "Evento" };
  list.innerHTML = evs.map((e) => `
    <div class="day-event-row">
      <div class="day-event-time">${escapeHtml(e.hora)}</div>
      <div>
        <div class="day-event-title">${escapeHtml(e.titulo)}</div>
        <div class="day-event-type">${tipoLabel[e.tipo] || "Evento"}</div>
      </div>
    </div>
  `).join("");
}

function addEvent() {
  if (!requireOpenPatient()) return;
  try {
    vita.agregarEvento({
      fecha: selectedDateKey,
      hora: $("meHora").value || "09:00",
      titulo: $("meTitulo").value,
      tipo: $("meTipo").value
    });
    $("meTitulo").value = "";
    closeModal("modalEvent");
    renderCalendar();
    renderHero();
    showToast("Evento agregado");
  } catch (error) {
    showToast(error.message || "Escribe un título para el evento");
  }
}

function openModal(id) {
  if (id === "modalEvent") {
    const d = new Date(selectedDateKey + "T00:00:00");
    const lbl = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    $("modalEventDateLabel").textContent = "Para el " + lbl;
  }
  $(id).classList.add("open");
}

function closeModal(id) {
  $(id).classList.remove("open");
}

function renderAll() {
  renderHeader();
  renderAccessCodeCard();
  loadHistoriaForm();
  renderContacts();
  renderMeds();
  renderCalendar();
  renderHero();
}

function openPinModal(mode) {
  pinMode = mode;
  $("pinError").classList.remove("show");
  $("pinInput").value = "";
  $("pin-title").textContent = mode === "activate" ? "Activar Vita" : "Desactivar Vita";
  $("pin-lead").textContent = mode === "activate"
    ? "Escribe la contraseña para que Vita ocupe toda esta pestaña."
    : "Escribe la contraseña para salir de Vita y volver a la app.";
  $("pin-modal").classList.add("open");
  setTimeout(() => $("pinInput").focus(), 50);
}

function closePinModal() {
  $("pin-modal").classList.remove("open");
}

function confirmPin() {
  const value = $("pinInput").value.trim();
  if (value !== VITA_PIN) {
    showAuthError("pinError", "Contraseña incorrecta.");
    $("pinInput").value = "";
    $("pinInput").focus();
    return;
  }
  closePinModal();
  if (pinMode === "activate") activateVita();
  else deactivateVita();
}

function activateVita() {
  vitaLocked = true;
  document.body.classList.add("vita-locked");
  $("vita-lock").classList.add("open");
  $("assistantStatus").textContent = "Toca el micrófono o escríbeme algo";
  requestVitaFullscreen();
}

function requestVitaFullscreen() {
  const lock = $("vita-lock");
  const req = lock.requestFullscreen || lock.webkitRequestFullscreen;
  if (req) {
    Promise.resolve(req.call(lock)).catch(() => {});
  }
}

function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  if (exit && document.fullscreenElement) {
    Promise.resolve(exit.call(document)).catch(() => {});
  }
}

function deactivateVita() {
  vitaLocked = false;
  document.body.classList.remove("vita-locked");
  $("vita-lock").classList.remove("open");
  vita.detenerEscucha();
  $("orb").classList.remove("thinking", "speaking", "listening");
  hideThinking();
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  exitFullscreen();
  showToast("Vita desactivada");
}

function seedAssistant() {
  if (!$("transcriptBox")) return;
  $("transcriptBox").innerHTML = "";
  addBubble(
    isNurse()
      ? "Hola. Puedo ayudarte a orientar a la persona a tu cargo y a revisar su cuidado."
      : "Hola. Estoy aquí contigo. Si quieres, te digo quién eres, dónde estás o quién te habla.",
    "assistant"
  );
}

function addBubble(text, who) {
  const box = $("transcriptBox");
  const b = document.createElement("div");
  b.className = "bubble " + who;
  b.textContent = text;
  box.appendChild(b);
  box.scrollTop = box.scrollHeight;
  return b;
}

function showThinking() {
  $("thinkingBubble")?.remove();
  const bubble = addBubble("Vita está pensando", "assistant");
  bubble.id = "thinkingBubble";
  bubble.classList.add("thinking");
}

function hideThinking() {
  $("thinkingBubble")?.remove();
}

function speakReply(reply, { slow = false } = {}) {
  addBubble(reply, "assistant");
  $("orb").classList.remove("thinking");
  $("orb").classList.add("speaking");
  $("assistantStatus").textContent = "Vita está respondiendo...";
  vita.hablar(reply, {
    slow,
    onEnd() {
      $("orb").classList.remove("speaking");
      $("assistantStatus").textContent = "Toca el micrófono o escríbeme algo";
    }
  });
}

async function handleUserInput(text) {
  if (!text?.trim() || vitaBusy) return;
  vitaBusy = true;
  addBubble(text, "user");
  const pedido = vita.aplicarPedidoAsistente(text);
  if (pedido) {
    speakReply(pedido, { slow: true });
    vitaBusy = false;
    return;
  }
  const tipo = vita.detectarDesorientacion(text);
  if (tipo) {
    speakReply(vita.orientar(tipo), { slow: true });
    vitaBusy = false;
    return;
  }
  showThinking();
  $("orb").classList.add("thinking");
  $("assistantStatus").textContent = "Vita está pensando...";
  try {
    const reply = await askVita(text, {
      vita,
      profile: currentProfile,
      onDataChanged() {
        renderAll();
      }
    });
    hideThinking();
    speakReply(reply);
  } catch (error) {
    hideThinking();
    const fallback = geminiErrorMessage(error) || vita.preguntar(text, false);
    speakReply(fallback);
  } finally {
    vitaBusy = false;
  }
}

function sendText() {
  if (vitaBusy) return;
  const input = $("textQuery");
  const val = input.value.trim();
  if (!val) return;
  input.value = "";
  handleUserInput(val);
}

function toggleListening() {
  if (vitaBusy) return;
  vita.escuchar({
    onStart() {
      $("micBtn").classList.add("rec");
      $("orb").classList.add("listening");
      $("assistantStatus").textContent = "Escuchando...";
    },
    onEnd() {
      $("micBtn").classList.remove("rec");
      $("orb").classList.remove("listening");
    },
    onError() {
      $("micBtn").classList.remove("rec");
      $("orb").classList.remove("listening");
      $("assistantStatus").textContent = "No pude escucharte. Intenta de nuevo o escribe abajo.";
    },
    onResult({ texto }) {
      handleUserInput(texto);
    }
  });
}

function bindEvents() {
  $("btn-login").addEventListener("click", doLogin);
  $("btn-register").addEventListener("click", doRegister);
  $("btn-show-register").addEventListener("click", showRegister);
  $("btn-show-login").addEventListener("click", showLogin);
  $("btn-save-profile").addEventListener("click", saveProfileAndEnter);
  $("btn-save-health").addEventListener("click", saveHealthAndEnter);
  $("btn-link-patient")?.addEventListener("click", linkPatientByCode);
  $("btn-change-patient")?.addEventListener("click", () => {
    activePatientUid = null;
    renderCareBanner();
    goTo("pacientes");
  });
  $("btn-copy-code")?.addEventListener("click", copyPatientCode);
  $("patientSearch")?.addEventListener("input", renderPatientRoster);
  $("linkPatientCode")?.addEventListener("input", (event) => {
    const compact = normalizeAccessCode(event.target.value).slice(0, 8);
    event.target.value = compact.length > 4 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
  });
  $("linkPatientCode")?.addEventListener("keydown", (e) => { if (e.key === "Enter") linkPatientByCode(); });
  $("hfPresentacion").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveHealthAndEnter(); } });
  $("loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("regPassword2").addEventListener("keydown", (e) => { if (e.key === "Enter") doRegister(); });
  $("profileTelefono").addEventListener("keydown", (e) => { if (e.key === "Enter") saveProfileAndEnter(); });
  $("btn-logout").addEventListener("click", doLogout);
  $("btn-save-historia").addEventListener("click", saveHistoria);
  $("btn-save-orientacion").addEventListener("click", saveOrientacion);
  document.querySelectorAll("[data-social]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      socialLogin(btn.dataset.social);
    });
  });
  $("btn-add-contact").addEventListener("click", addContact);
  $("btn-add-med").addEventListener("click", addMed);
  $("cal-prev").addEventListener("click", () => shiftMonth(-1));
  $("cal-next").addEventListener("click", () => shiftMonth(1));
  $("btn-open-event").addEventListener("click", () => openModal("modalEvent"));
  $("btn-cancel-event").addEventListener("click", () => closeModal("modalEvent"));
  $("btn-save-event").addEventListener("click", addEvent);
  $("btn-cancel-pin").addEventListener("click", closePinModal);
  $("btn-confirm-pin").addEventListener("click", confirmPin);
  $("pinInput").addEventListener("keydown", (e) => { if (e.key === "Enter") confirmPin(); });
  $("btn-deactivate").addEventListener("click", () => openPinModal("deactivate"));
  $("btn-send").addEventListener("click", sendText);
  $("micBtn").addEventListener("click", toggleListening);
  $("textQuery").addEventListener("keydown", (e) => { if (e.key === "Enter") sendText(); });

  document.querySelectorAll("[data-activate-vita]").forEach((btn) => {
    btn.addEventListener("click", () => openPinModal("activate"));
  });

  document.addEventListener("click", (event) => {
    const roleCard = event.target.closest(".role-card");
    if (roleCard) {
      const picker = roleCard.closest(".role-picker");
      if (picker?.id === "regRolePicker") selectRole("regRolePicker", roleCard.dataset.role, "reg");
      if (picker?.id === "profileRolePicker") selectRole("profileRolePicker", roleCard.dataset.role, "profile");
    }

    const nav = event.target.closest("[data-nav]");
    if (nav) goTo(nav.dataset.nav);

    const openPatientBtn = event.target.closest("[data-open-patient]");
    if (openPatientBtn) openPatient(openPatientBtn.dataset.openPatient);

    const toggle = event.target.closest("[data-toggle-med]");
    if (toggle) {
      vita.marcarMedicamentoTomado(toggle.dataset.toggleMed, toggle.dataset.hora);
      renderHomeMeds();
    }

    const delMed = event.target.closest("[data-del-med]");
    if (delMed) {
      if (!requireOpenPatient()) return;
      event.preventDefault();
      vita.eliminarMedicamento(delMed.dataset.delMed);
      renderMeds();
      renderHero();
      showToast("Medicamento eliminado");
    }

    const callBtn = event.target.closest("[data-call]");
    if (callBtn) vita.llamarContacto(callBtn.dataset.call);

    const smsBtn = event.target.closest("[data-sms]");
    if (smsBtn) vita.enviarSMS(smsBtn.dataset.sms);

    const day = event.target.closest("[data-date]");
    if (day) {
      selectedDateKey = day.dataset.date;
      renderCalendar();
    }

    const ask = event.target.closest("[data-ask]");
    if (ask) handleUserInput(ask.dataset.ask);
  });

  document.addEventListener("keydown", (event) => {
    if (!vitaLocked) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
    }
    if ((event.ctrlKey || event.metaKey) && ["t", "w", "n"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
  }, true);

  document.addEventListener("fullscreenchange", () => {
    if (vitaLocked && !document.fullscreenElement) {
      requestVitaFullscreen();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden || !vitaLocked) return;
    requestVitaFullscreen();
  });
}

function init() {
  vita.onRemoteSave = queueRemoteSave;
  $("btn-logout").insertAdjacentHTML("afterbegin", ICONS.logout);
  $("cal-prev").innerHTML = ICONS.chevL;
  $("cal-next").innerHTML = ICONS.chevR;
  $("btn-send").innerHTML = ICONS.send;
  $("micBtn").innerHTML = ICONS.mic;
  document.querySelectorAll("[data-activate-vita]").forEach((btn) => {
    btn.insertAdjacentHTML("afterbegin", ICONS.mic);
  });
  renderNav();
  bindEvents();

  onAuthStateChanged(auth, async (user) => {
    if (authBusy) return;
    if (!user && sessionStorage.getItem("vita_social")) return;
    await handleAuthenticatedUser(user);
  });

  getRedirectResult(auth).then(async (result) => {
    if (!result?.user) return;
    sessionStorage.removeItem("vita_social");
    await handleAuthenticatedUser(result.user);
  }).catch((error) => {
    const provider = sessionStorage.getItem("vita_social");
    sessionStorage.removeItem("vita_social");
    if (provider === "apple") {
      showAuthError("loginError", "Apple no pudo completar el acceso en este equipo. Entra con Google o con correo.");
      return;
    }
    showAuthError("loginError", firebaseAuthMessage(error));
  });
}

window.vitaApp = {
  login: doLogin,
  register: doRegister,
  social: socialLogin,
  showRegister,
  showLogin
};

try {
  init();
} catch (error) {
  console.error(error);
  const el = document.getElementById("loginError");
  if (el) {
    el.textContent = "No se pudo iniciar Vita. Recarga la página.";
    el.classList.add("show");
  }
}
