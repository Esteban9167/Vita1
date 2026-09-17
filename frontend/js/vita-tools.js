function findByName(list, nombre) {
  const q = String(nombre || "").trim().toLowerCase();
  if (!q) return null;
  return list.find((item) => String(item.nombre).toLowerCase() === q)
    || list.find((item) => String(item.nombre).toLowerCase().includes(q));
}

export function runVitaTool(name, args, vita) {
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
    case "agregar_medicamento": {
      const med = vita.agregarMedicamento({ nombre: a.nombre, dosis: a.dosis, horarios: a.horarios });
      return { ok: true, medicamento: { id: med.id, nombre: med.nombre, dosis: med.dosis, horarios: med.horarios } };
    }
    case "eliminar_medicamento": {
      const found = vita.obtenerMedicamentos().find((m) => String(m.id) === String(a.id)) || findByName(vita.obtenerMedicamentos(), a.nombre);
      if (!found) return { ok: false, error: "No encontré ese medicamento." };
      vita.eliminarMedicamento(found.id);
      return { ok: true, eliminado: found.nombre };
    }
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

export function buildSnapshot(vita) {
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
