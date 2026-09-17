import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { auth, db, googleProvider, appleProvider } from "./firebase.js";
import { askVita, resetVitaChat, geminiErrorMessage } from "./api.js";

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
  const profile = {
    uid: user.uid,
    email: user.email || "",
    nombre: data.nombre,
    telefono: data.telefono,
    rol: data.rol
  };
  writeLocalProfile(user.uid, profile);
  try {
    await setDoc(doc(db, "usuarios", user.uid), {
      ...profile,
      actualizadoEn: serverTimestamp()
    }, { merge: true });
  } catch {
    // Si Firestore no está listo, el perfil local alcanza para entrar.
  }
  return profile;
}

function showAuthScreen() {
  currentUser = null;
  currentProfile = null;
  resetVitaChat();
  $("transcriptBox").innerHTML = "";
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
  ["loginError", "registerError", "profileError"].forEach((id) => {
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
  const provider = providerName === "apple" ? appleProvider : googleProvider;
  const errorId = $("registerForm").style.display === "block" ? "registerError" : "loginError";
  hideAuthErrors();
  sessionStorage.setItem("vita_social", providerName);
  showAuthError(errorId, providerName === "apple"
    ? "Abriendo Apple..."
    : "Abriendo Google...");
  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    try {
      await signInWithPopup(auth, provider);
    } catch (popupError) {
      if (providerName === "apple") {
        showAuthError(errorId, "Apple no pudo completar el acceso en este equipo. Entra con Google o con correo.");
        return;
      }
      showAuthError(errorId, firebaseAuthMessage(popupError));
    }
  }
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
    enterApp(user, profile);
  } catch (error) {
    const cached = readLocalProfile(user.uid);
    if (profileComplete(cached)) {
      enterApp(user, cached);
      return;
    }
    showProfileGate(user, cached);
    showAuthError("profileError", "Entra con tus datos básicos. Si Firestore no está listo, igual puedes usar Vita.");
  }
}

function enterApp(user, profile) {
  if (currentUser === user.uid && currentProfile) return;
  currentUser = user.uid;
  currentProfile = profile;
  resetVitaChat();
  const nombre = profile.nombre || user.displayName || "Usuario";
  vita.switchProfile(user.uid);
  vita.setPatientName(nombre);
  seedAssistant();
  $("auth-screen").style.display = "none";
  $("profileForm").style.display = "none";
  $("app-container").classList.add("active");
  $("sidebarEmail").textContent = roleLabel(profile.rol);
  renderAll();
  goTo("inicio");
}

async function doLogout() {
  if (vitaLocked) return;
  await signOut(auth);
  showToast("Sesión cerrada");
}

function goTo(name) {
  if (vitaLocked) return;
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + name));
  document.querySelectorAll(".side-link").forEach((b) => b.classList.toggle("active", b.dataset.nav === name));
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (name === "calendario") renderCalendar();
}

function renderNav() {
  $("side-nav").innerHTML = NAV.map((item) => `
    <button class="side-link ${item.id === "inicio" ? "active" : ""}" type="button" data-nav="${item.id}">
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
  const name = vita.getPatientName();
  $("greeting-time").textContent = h < 12 ? "Buenos días" : (h < 19 ? "Buenas tardes" : "Buenas noches");
  $("greeting-name").textContent = name.split(" ")[0];
  $("avatarBadge").textContent = name[0] || "V";
  $("sidebarName").textContent = name;
  const opts = { weekday: "long", day: "numeric", month: "long" };
  const label = today.toLocaleDateString("es-ES", opts);
  $("today-label").textContent = label.charAt(0).toUpperCase() + label.slice(1);
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
  renderOrientacionCard();
}

function applyHistoriaPermissions() {
  const locked = !isNurse();
  ["hcSangre", "hcAlergias", "hcCronicas", "hcCirugias", "hcNotas", "orLugar", "orAcompanante", "orPresentacion"].forEach((id) => {
    const el = $(id);
    el.readOnly = locked;
    el.classList.toggle("is-readonly", locked);
  });
  $("btn-save-historia").hidden = locked;
  $("btn-save-orientacion").hidden = locked;
  $("historiaLockNote").hidden = !locked;
  $("orientacionLockNote").hidden = !locked;
}

function saveOrientacion() {
  if (!isNurse()) {
    showToast("Solo un enfermero puede actualizar estos datos.");
    return;
  }
  vita.guardarOrientacion({
    lugar: $("orLugar").value,
    acompanante: $("orAcompanante").value,
    presentacion: $("orPresentacion").value
  });
  renderOrientacionCard();
  showToast("Datos de orientación guardados");
}

function renderOrientacionCard() {
  const o = vita.obtenerOrientacion();
  $("orientName").textContent = o.nombre;
  $("orientPlace").textContent = o.lugar;
  $("orientVoice").textContent = o.presentacion;
}

function startOrientacion() {
  const reply = vita.orientar("reorientar");
  $("homeOrientCard").classList.add("is-active");
  setTimeout(() => $("homeOrientCard").classList.remove("is-active"), 4000);
  if (vitaLocked) {
    handleUserInput("Ayúdame a ubicarme");
    return;
  }
  vita.hablar(reply, { rate: 0.86 });
  showToast("Vita te está ubicando con calma");
}

function saveHistoria() {
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
  try {
    vita.agregarMedicamento({
      nombre: $("mmNombre").value,
      dosis: $("mmDosis").value,
      horarios: $("mmHorarios").value
    });
    ["mmNombre", "mmDosis", "mmHorarios"].forEach((id) => $(id).value = "");
    renderMeds();
    showToast("Medicamento agregado");
  } catch (error) {
    showToast(error.message || "Completa nombre y horario");
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
  $("transcriptBox").innerHTML = "";
  addBubble("Hola. Estoy aquí contigo. Si quieres, te digo quién eres, dónde estás o quién te habla.", "assistant");
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
    rate: slow ? 0.86 : 0.96,
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
  $("loginPassword").addEventListener("keydown", (e) => { if (e.key === "Enter") doLogin(); });
  $("regPassword2").addEventListener("keydown", (e) => { if (e.key === "Enter") doRegister(); });
  $("profileTelefono").addEventListener("keydown", (e) => { if (e.key === "Enter") saveProfileAndEnter(); });
  $("btn-logout").addEventListener("click", doLogout);
  $("btn-save-historia").addEventListener("click", saveHistoria);
  $("btn-save-orientacion").addEventListener("click", saveOrientacion);
  $("btn-orientar").addEventListener("click", startOrientacion);
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

    const toggle = event.target.closest("[data-toggle-med]");
    if (toggle) {
      vita.marcarMedicamentoTomado(toggle.dataset.toggleMed, toggle.dataset.hora);
      renderHomeMeds();
    }

    const delMed = event.target.closest("[data-del-med]");
    if (delMed) {
      vita.eliminarMedicamento(delMed.dataset.delMed);
      renderMeds();
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

  getRedirectResult(auth).catch((error) => {
    const provider = sessionStorage.getItem("vita_social");
    if (provider === "apple") {
      showAuthError("loginError", "Apple no pudo completar el acceso en este equipo. Entra con Google o con correo.");
      return;
    }
    showAuthError("loginError", firebaseAuthMessage(error));
  });

  onAuthStateChanged(auth, async (user) => {
    if (authBusy) return;
    await handleAuthenticatedUser(user);
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
    el.textContent = "No se pudo iniciar Vita. Recarga http://localhost:3000";
    el.classList.add("show");
  }
}
