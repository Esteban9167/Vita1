function projectId() {
  return process.env.FIREBASE_PROJECT_ID;
}

function base() {
  return `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/usuarios`;
}

function str(value) {
  return { stringValue: String(value ?? "") };
}

function ts(date = new Date()) {
  return { timestampValue: date.toISOString() };
}

function readString(fields, key) {
  return fields?.[key]?.stringValue || "";
}

function toProfile(doc) {
  if (!doc?.fields) return null;
  const fields = doc.fields;
  return {
    uid: readString(fields, "uid"),
    email: readString(fields, "email"),
    nombre: readString(fields, "nombre"),
    telefono: readString(fields, "telefono"),
    rol: readString(fields, "rol")
  };
}

export async function getProfile(uid, idToken) {
  const response = await fetch(`${base()}/${uid}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (response.status === 404) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || "No se pudo leer el perfil.");
    error.status = response.status;
    throw error;
  }
  return toProfile(data);
}

export async function saveProfile(user, data, idToken) {
  const body = {
    fields: {
      uid: str(user.uid),
      email: str(user.email || ""),
      nombre: str(data.nombre),
      telefono: str(data.telefono),
      rol: str(data.rol),
      actualizadoEn: ts()
    }
  };
  const response = await fetch(
    `${base()}/${user.uid}?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=nombre&updateMask.fieldPaths=telefono&updateMask.fieldPaths=rol&updateMask.fieldPaths=actualizadoEn`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );
  const saved = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(saved?.error?.message || "No se pudo guardar el perfil.");
    error.status = response.status;
    throw error;
  }
  return toProfile(saved);
}
