// =====================================================
// VITA CORE
// Solo funcionalidades. Sin HTML y sin CSS.
// =====================================================

class VitaCore {

  constructor() {

    this.storageKey = "vita_app_data";
    this.state = this.estadoInicial();
    this.historiaLocked = true;
    this.onRemoteSave = null;

    this.recognition = null;
    this.listening = false;
    this.speechToken = 0;
    this.preferredVoice = null;

    this.load();
    this.configurarReconocimientoVoz();
    this.prepararVoces();
  }


  // =====================================================
  // GUARDAR / CARGAR DATOS
  // =====================================================

  save() {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(this.state)
    );
    try {
      this.onRemoteSave?.(this.getState());
    } catch (error) {
      console.error("No fue posible sincronizar Vita:", error);
    }
  }


  applyState(data) {
    if (!data || typeof data !== "object") return;
    this.state = {
      ...this.estadoInicial(),
      ...data,
      historia: {
        ...this.estadoInicial().historia,
        ...(data.historia || {})
      },
      orientacion: {
        ...this.estadoInicial().orientacion,
        ...(data.orientacion || {})
      },
      contactos: Array.isArray(data.contactos) ? data.contactos : [],
      medicamentos: Array.isArray(data.medicamentos) ? data.medicamentos : [],
      eventos: data.eventos && typeof data.eventos === "object" ? data.eventos : {}
    };
    this.repararIdsMedicamentos();
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(this.state)
    );
  }


  hasCareData() {
    const h = this.state.historia || {};
    const o = this.state.orientacion || {};
    return !!(
      h.sangre?.trim()
      || h.alergias?.trim()
      || h.cronicas?.trim()
      || h.cirugias?.trim()
      || h.notas?.trim()
      || o.lugar?.trim()
      || o.acompanante?.trim()
      || o.presentacion?.trim()
      || this.state.contactos?.length
      || this.state.medicamentos?.length
      || Object.keys(this.state.eventos || {}).length
    );
  }


  load() {

    const saved = localStorage.getItem(this.storageKey);

    if (!saved) return;

    try {
      this.applyState(JSON.parse(saved));
    } catch (error) {

      console.error(
        "No fue posible cargar los datos de Vita:",
        error
      );

    }

  }


  estadoInicial() {
    return {
      patientName: "María López",
      historia: {
        sangre: "",
        alergias: "",
        cronicas: "",
        cirugias: "",
        notas: ""
      },
      orientacion: {
        lugar: "",
        acompanante: "",
        presentacion: ""
      },
      contactos: [],
      medicamentos: [],
      eventos: {},
      nextMedId: 1
    };
  }


  switchProfile(uid) {
    this.storageKey = uid
      ? `vita_app_data_${uid}`
      : "vita_app_data";
    this.state = this.estadoInicial();
    this.load();
  }


  getState() {
    return structuredClone(this.state);
  }


  // =====================================================
  // PACIENTE
  // =====================================================

  setPatientName(nombre) {

    if (!nombre?.trim()) return false;

    this.state.patientName = nombre.trim();

    this.save();

    return true;
  }


  getPatientName() {
    return this.state.patientName;
  }


  // =====================================================
  // HISTORIA CLÍNICA
  // =====================================================

  setHistoriaLocked(locked) {
    this.historiaLocked = !!locked;
  }

  guardarHistoria(datos = {}) {
    if (this.historiaLocked) {
      return this.obtenerHistoria();
    }

    this.state.historia = {

      sangre:
        datos.sangre?.trim() || "",

      alergias:
        datos.alergias?.trim() || "",

      cronicas:
        datos.cronicas?.trim() || "",

      cirugias:
        datos.cirugias?.trim() || "",

      notas:
        datos.notas?.trim() || ""

    };

    this.save();

    return this.state.historia;
  }


  obtenerHistoria() {

    return {
      ...this.state.historia
    };

  }


  guardarOrientacion(datos = {}) {
    if (this.historiaLocked) {
      return this.obtenerOrientacion();
    }
    this.state.orientacion = {
      lugar: datos.lugar?.trim() || "",
      acompanante: datos.acompanante?.trim() || "",
      presentacion: datos.presentacion?.trim() || ""
    };
    this.save();
    return this.obtenerOrientacion();
  }


  obtenerOrientacion() {
    const nombre = this.state.patientName || "tú";
    const lugar = this.state.orientacion?.lugar?.trim() || "en un lugar seguro";
    const acompanante = this.state.orientacion?.acompanante?.trim() || "";
    const presentacion = this.state.orientacion?.presentacion?.trim()
      || "Soy Vita, tu compañera de cuidado. Estoy aquí contigo.";
    const contacto = this.state.contactos[0] || null;
    return {
      nombre,
      primerNombre: nombre.split(" ")[0],
      lugar,
      acompanante,
      presentacion,
      contacto
    };
  }


  detectarDesorientacion(texto) {
    const t = this.normalizar(texto);

    if (
      /ayudame a ubic|ubicarme|estoy perd|me perdi|estoy confund|no se que (pasa|hago|hacer)|estoy asust|tengo miedo|protocolo de orient/
        .test(t)
    ) {
      return "reorientar";
    }

    if (
      /quien soy|como me llamo|cual es mi nombre|no se (quien soy|como me llamo)|no me acuerdo (quien soy|mi nombre|de mi nombre)/
        .test(t)
    ) {
      return "identidad";
    }

    if (
      /donde estoy|donde vivo|que (lugar|sitio) es este|en donde estoy|estoy en casa/
        .test(t)
    ) {
      return "lugar";
    }

    if (
      /quien (eres|me habla|sos|es vita)|con quien hablo|quien me esta hablando|tu nombre|como te llamas/
        .test(t)
    ) {
      return "quien_habla";
    }

    return null;
  }


  fichaClinicaCompleta() {
    const h = this.obtenerHistoria();
    const o = this.state.orientacion || {};
    return !!(
      h.sangre?.trim()
      && h.alergias?.trim()
      && h.cronicas?.trim()
      && h.cirugias?.trim()
      && h.notas?.trim()
      && o.lugar?.trim()
      && o.acompanante?.trim()
      && o.presentacion?.trim()
    );
  }


  aplicarPedidoAsistente(texto) {
    const t = this.normalizar(texto);
    const pideCambio =
      /(?:agrega(?:me)?|añade|anade|anota|registra(?:me)?|pon(?:me)?|guarda(?:me)?|cambia(?:me)?|modifica(?:me)?|elimina(?:me)?|borra(?:me)?|quita(?:me)?|saca(?:me)?|ya no tomo|me recetaron|me dieron|tengo que tomar|nueva dosis|otra dosis)/.test(t)
      && /(?:medicamento|pastilla|medicina|tableta|capsula|jarabe|\d+\s*(?:mg|ml|mcg)|a las|a la)/.test(t);

    const pideQuitar = /(?:elimina(?:me)?|borra(?:me)?|quita(?:me)?|saca(?:me)?|ya no tomo)\s+(?:el |la |los |las )?(?:medicamento |pastilla |medicina |tableta )/.test(t)
      || (/(?:elimina(?:me)?|borra(?:me)?|quita(?:me)?|saca(?:me)?|ya no tomo)/.test(t) && this.state.medicamentos.some((med) => t.includes(this.normalizar(med.nombre))));

    if (!pideCambio && !pideQuitar) return null;

    const nombre = this.getPatientName()?.split(" ")[0] || "";
    const trato = nombre ? `${nombre}, ` : "";
    return (
      `Está bien, ${trato}no te preocupes. `
      + `Eso se lo consulto a tu doctor, para que quede como debe ser. `
      + `Por ahora no cambio tus medicamentos. Estoy aquí contigo.`
    );
  }


  orientar(tipo = "reorientar") {
    const o = this.obtenerOrientacion();
    const oferta = o.contacto
      ? ` Si quieres, puedo llamar a ${o.contacto.nombre}.`
      : " Si quieres, quédate conmigo un momento.";

    if (tipo === "identidad") {
      return `Todo está bien. Tú eres ${o.nombre}.`;
    }

    if (tipo === "lugar") {
      return (
        `Estás a salvo. Estás ${o.lugar}.`
        + (o.acompanante ? ` ${o.acompanante}.` : "")
      );
    }

    if (tipo === "quien_habla") {
      return `${o.presentacion} No hay ningún problema.`;
    }

    return (
      `Todo está bien. Estás a salvo. `
      + `${o.presentacion} `
      + `Tú eres ${o.nombre}. `
      + `Estás ${o.lugar}.`
      + (o.acompanante ? ` ${o.acompanante}.` : "")
      + oferta
    );
  }


  // =====================================================
  // CONTACTOS DE EMERGENCIA
  // =====================================================

  agregarContacto({
    nombre,
    relacion = "Contacto",
    telefono
  }) {

    if (!nombre?.trim() || !telefono?.trim()) {
      throw new Error(
        "Nombre y teléfono son obligatorios."
      );
    }

    const contacto = {

      id: crypto.randomUUID(),

      nombre: nombre.trim(),

      relacion:
        relacion?.trim() || "Contacto",

      telefono: telefono.trim()

    };

    this.state.contactos.push(contacto);

    this.save();

    return contacto;
  }


  obtenerContactos() {

    return structuredClone(
      this.state.contactos
    );

  }


  eliminarContacto(id) {

    this.state.contactos =
      this.state.contactos.filter(
        contacto => contacto.id !== id
      );

    this.save();
  }


  llamarContacto(id) {

    const contacto =
      this.state.contactos.find(
        contacto => contacto.id === id
      );

    if (!contacto) return;

    window.location.href =
      `tel:${contacto.telefono}`;

  }


  enviarSMS(id) {

    const contacto =
      this.state.contactos.find(
        contacto => contacto.id === id
      );

    if (!contacto) return;

    window.location.href =
      `sms:${contacto.telefono}`;

  }


  // =====================================================
  // MEDICAMENTOS
  // =====================================================

  parseHorarios(raw) {
    if (Array.isArray(raw)) {
      return raw.flatMap((item) => this.parseHorarios(item));
    }
    if (raw && typeof raw === "object") {
      return Object.values(raw).flatMap((item) => this.parseHorarios(item));
    }
    return String(raw || "")
      .split(/[,;]|(\s+y\s+)/i)
      .map((part) => String(part || "").replace(/a\s*las/gi, "").trim())
      .filter((part) => part && part.toLowerCase() !== "y")
      .map((part) => this.normalizarHora(part))
      .filter(Boolean);
  }

  normalizarHora(texto) {
    const raw = String(texto || "").trim();
    if (!raw) return "";
    const compact = raw.toLowerCase().replace(/\s+/g, "");
    const match = compact.match(/^(\d{1,2})(?::(\d{2}))?(am|pm)?$/);
    if (!match) return raw;
    let hour = Number(match[1]);
    const minutes = match[2] || "00";
    const meridiem = match[3];
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    if (hour > 23 || Number(minutes) > 59) return raw;
    return `${String(hour).padStart(2, "0")}:${minutes}`;
  }

  repararIdsMedicamentos() {
    if (!Array.isArray(this.state.medicamentos)) this.state.medicamentos = [];
    let maxId = 0;
    this.state.medicamentos.forEach((med, index) => {
      const id = Number(med?.id);
      if (Number.isFinite(id) && id > 0) {
        med.id = id;
        maxId = Math.max(maxId, id);
      } else {
        med.id = index + 1;
        maxId = Math.max(maxId, med.id);
      }
    });
    const next = Number(this.state.nextMedId);
    this.state.nextMedId = Number.isFinite(next) && next > maxId ? next : maxId + 1;
  }

  agregarMedicamento({
    nombre,
    dosis = "",
    horarios = [],
    hora,
    horario
  }) {

    if (!nombre?.trim()) {
      throw new Error(
        "Debe indicar el medicamento."
      );
    }

    horarios = this.parseHorarios(
      (Array.isArray(horarios) && horarios.length) || (typeof horarios === "string" && horarios.trim())
        ? horarios
        : (horario ?? hora)
    );

    if (horarios.length === 0) {
      throw new Error(
        "Indica al menos un horario, por ejemplo 08:00, 20:00."
      );
    }

    this.repararIdsMedicamentos();

    const medicamento = {

      id: this.state.nextMedId++,

      nombre: nombre.trim(),

      dosis:
        dosis?.trim() || "—",

      horarios,

      tomado: {}

    };


    this.state.medicamentos.push(
      medicamento
    );

    this.save();

    return medicamento;
  }


  obtenerMedicamentos() {

    return structuredClone(
      this.state.medicamentos
    );

  }


  eliminarMedicamento(id) {
    this.repararIdsMedicamentos();
    const key = String(id);
    this.state.medicamentos =
      this.state.medicamentos.filter(
        medicamento =>
          String(medicamento.id) !== key
      );

    this.save();

  }


  // =====================================================
  // CONTROL DE MEDICAMENTOS TOMADOS
  // =====================================================

  marcarMedicamentoTomado(
    medicamentoId,
    hora,
    fecha = new Date()
  ) {

    const medicamento =
      this.state.medicamentos.find(
        med =>
          med.id === Number(medicamentoId)
      );


    if (!medicamento) {
      throw new Error(
        "Medicamento no encontrado."
      );
    }


    const fechaKey =
      this.formatearFecha(fecha);

    const key =
      `${fechaKey}_${hora}`;


    medicamento.tomado[key] =
      !medicamento.tomado[key];


    this.save();


    return medicamento.tomado[key];
  }


  medicamentoFueTomado(
    medicamentoId,
    hora,
    fecha = new Date()
  ) {

    const medicamento =
      this.state.medicamentos.find(
        med =>
          med.id === Number(medicamentoId)
      );


    if (!medicamento) return false;


    const key =
      `${this.formatearFecha(fecha)}_${hora}`;


    return !!medicamento.tomado[key];
  }


  medicamentosDeHoy() {

    const fecha = new Date();

    const lista = [];


    this.state.medicamentos
      .forEach(medicamento => {

        medicamento.horarios
          .forEach(hora => {

            lista.push({

              id:
                medicamento.id,

              nombre:
                medicamento.nombre,

              dosis:
                medicamento.dosis,

              hora,

              tomado:
                this.medicamentoFueTomado(
                  medicamento.id,
                  hora,
                  fecha
                )

            });

          });

      });


    return lista.sort(
      (a, b) =>
        a.hora.localeCompare(b.hora)
    );

  }


  // =====================================================
  // CALENDARIO
  // =====================================================

  formatearFecha(fecha) {

    const d =
      fecha instanceof Date
        ? fecha
        : new Date(
            `${fecha}T00:00:00`
          );


    return (
      d.getFullYear()
      + "-"
      + String(
          d.getMonth() + 1
        ).padStart(2, "0")
      + "-"
      + String(
          d.getDate()
        ).padStart(2, "0")
    );

  }


  agregarEvento({
    fecha,
    hora = "09:00",
    titulo,
    tipo = "otro"
  }) {

    if (!fecha) {
      throw new Error(
        "La fecha es obligatoria."
      );
    }


    if (!titulo?.trim()) {
      throw new Error(
        "El título es obligatorio."
      );
    }


    const fechaKey =
      this.formatearFecha(fecha);


    if (!this.state.eventos[fechaKey]) {
      this.state.eventos[fechaKey] = [];
    }


    const evento = {

      id:
        crypto.randomUUID(),

      hora,

      titulo:
        titulo.trim(),

      tipo

    };


    this.state.eventos[
      fechaKey
    ].push(evento);


    this.save();

    return evento;
  }


  obtenerEventos(fecha) {

    const fechaKey =
      this.formatearFecha(fecha);


    return structuredClone(
      this.state.eventos[
        fechaKey
      ] || []
    ).sort(
      (a, b) =>
        a.hora.localeCompare(b.hora)
    );

  }


  eliminarEvento(fecha, eventoId) {

    const fechaKey =
      this.formatearFecha(fecha);


    if (
      !this.state.eventos[
        fechaKey
      ]
    ) return;


    this.state.eventos[
      fechaKey
    ] =
      this.state.eventos[
        fechaKey
      ].filter(
        evento =>
          evento.id !== eventoId
      );


    this.save();

  }


  // =====================================================
  // PRÓXIMO EVENTO
  // =====================================================

  obtenerProximoEvento() {

    const ahora = new Date();

    let proximo = null;


    Object.entries(
      this.state.eventos
    ).forEach(
      ([fecha, eventos]) => {

        eventos.forEach(
          evento => {

            const fechaHora =
              new Date(
                `${fecha}T${evento.hora}:00`
              );


            if (
              fechaHora >= ahora
              &&
              (
                !proximo
                ||
                fechaHora <
                  proximo.fechaHora
              )
            ) {

              proximo = {

                fecha,

                fechaHora,

                ...evento

              };

            }

          }
        );

      }
    );


    return proximo;

  }


  // =====================================================
  // ASISTENTE
  // =====================================================

  normalizar(texto) {

    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      );

  }


  responder(texto) {

    const t =
      this.normalizar(texto);

    const orientacion =
      this.detectarDesorientacion(texto);

    if (orientacion) {
      return this.orientar(orientacion);
    }


    const primerNombre =
      this.state.patientName
        .split(" ")[0];


    // SALUDO

    if (
      /\b(hola|buenas|hey|hi)\b/
        .test(t)
    ) {

      return (
        `Hola ${primerNombre}. `
        + `Soy Vita, estoy aquí contigo. `
        + `Si quieres, te digo quién eres, `
        + `dónde estás o te ayudo a ubicarte.`
      );

    }


    // MEDICAMENTOS

    if (
      /medicament|medicina|pastilla/
        .test(t)
    ) {

      const meds =
        this.medicamentosDeHoy();


      if (!meds.length) {

        return (
          "No tienes medicamentos "
          + "registrados."
        );

      }


      return (
        "Hoy tienes: "
        +
        meds.map(
          medicamento =>
            `${medicamento.nombre} `
            + `${medicamento.dosis} `
            + `a las ${medicamento.hora}`
        ).join(", ")
        +
        "."
      );

    }


    // PRÓXIMA CITA

    if (
      /proxim|cita|evento/
        .test(t)
    ) {

      const evento =
        this.obtenerProximoEvento();


      if (!evento) {

        return (
          "No tienes citas ni eventos "
          + "programados."
        );

      }


      const fechaTexto =
        evento.fechaHora
          .toLocaleDateString(
            "es-CO",
            {
              weekday: "long",
              day: "numeric",
              month: "long"
            }
          );


      return (
        `Tu próximo evento es `
        + `"${evento.titulo}" `
        + `el ${fechaTexto} `
        + `a las ${evento.hora}.`
      );

    }


    // CONTACTOS

    if (
      /contacto|emergencia|llamar/
        .test(t)
    ) {

      if (
        !this.state.contactos.length
      ) {

        return (
          "No tienes contactos de "
          + "emergencia registrados."
        );

      }


      const contacto =
        this.state.contactos[0];


      return (
        `Tu contacto principal es `
        + `${contacto.nombre}, `
        + `${contacto.relacion}, `
        + `teléfono ${contacto.telefono}.`
      );

    }


    // ALERGIAS

    if (
      /alergi/
        .test(t)
    ) {

      if (
        !this.state.historia.alergias
      ) {

        return (
          "No tienes alergias registradas."
        );

      }


      return (
        "Tus alergias registradas son: "
        +
        this.state.historia.alergias
        +
        "."
      );

    }


    // TIPO DE SANGRE

    if (
      /sangre|grupo sanguineo/
        .test(t)
    ) {

      if (
        !this.state.historia.sangre
      ) {

        return (
          "No tienes registrado "
          + "tu tipo de sangre."
        );

      }


      return (
        "Tu tipo de sangre registrado es "
        +
        this.state.historia.sangre
        +
        "."
      );

    }


    // HORA

    if (
      /que hora|hora es/
        .test(t)
    ) {

      return (
        "Son las "
        +
        new Date()
          .toLocaleTimeString(
            "es-CO",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          )
        +
        "."
      );

    }


    // GRACIAS

    if (
      /gracias/
        .test(t)
    ) {

      return (
        "Con mucho gusto."
      );

    }


    return (
      "Por ahora puedo ayudarte con "
      + "medicamentos, próximas citas, "
      + "alergias, historia clínica "
      + "y contactos de emergencia."
    );

  }


  // =====================================================
  // RECONOCIMIENTO DE VOZ
  // =====================================================

  configurarReconocimientoVoz() {

    const SpeechRecognition =
      window.SpeechRecognition
      ||
      window.webkitSpeechRecognition;


    if (!SpeechRecognition) {

      console.warn(
        "El navegador no soporta "
        + "reconocimiento de voz."
      );

      return;

    }


    this.recognition =
      new SpeechRecognition();


    this.recognition.lang =
      "es-CO";


    this.recognition.interimResults =
      false;


    this.recognition.continuous =
      false;

  }


  async pedirPermisoMicrofono() {
    if (!window.isSecureContext) {
      const error = new Error("insecure");
      error.name = "SecurityError";
      throw error;
    }
    if (navigator.mediaDevices?.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true }
      });
      stream.getTracks().forEach((track) => track.stop());
    } else if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
      const error = new Error("unsupported");
      error.name = "NotSupportedError";
      throw error;
    }
    this.configurarReconocimientoVoz();
    if (!this.recognition) return;
    await new Promise((resolve, reject) => {
      const rec = this.recognition;
      const finish = (error) => {
        rec.onstart = null;
        rec.onend = null;
        rec.onerror = null;
        rec.onresult = null;
        if (error) reject(error);
        else resolve();
      };
      rec.onstart = () => {
        try { rec.stop(); } catch {}
      };
      rec.onend = () => finish();
      rec.onerror = (event) => {
        if (event?.error === "not-allowed" || event?.error === "service-not-allowed") {
          const error = new Error(event.error);
          error.name = "NotAllowedError";
          finish(error);
          return;
        }
        finish();
      };
      try {
        rec.start();
      } catch (error) {
        finish();
      }
    });
  }


  escuchar({
    onStart,
    onResult,
    onError,
    onEnd
  } = {}) {

    if (!this.recognition) {

      onError?.(
        "El navegador no soporta "
        + "reconocimiento de voz."
      );

      return;

    }


    this.recognition.onstart =
      () => {

        this.listening = true;

        onStart?.();

      };


    this.recognition.onresult =
      event => {

        const texto =
          event.results[0][0]
            .transcript;


        const respuesta =
          this.responder(texto);


        onResult?.({
          texto,
          respuesta
        });

      };


    this.recognition.onerror =
      error => {

        this.listening = false;

        onError?.(error);

      };


    this.recognition.onend =
      () => {

        this.listening = false;

        onEnd?.();

      };


    try {

      this.recognition.start();

    } catch (error) {

      console.error(error);

    }

  }


  detenerEscucha() {

    if (
      this.recognition
      &&
      this.listening
    ) {

      this.recognition.stop();

    }

  }


  // =====================================================
  // TEXTO A VOZ
  // =====================================================

  prepararVoces() {
    if (!window.speechSynthesis) return Promise.resolve(null);
    const tomar = () => {
      this.preferredVoice = this.elegirVozHumana();
      return this.preferredVoice;
    };
    if (window.speechSynthesis.getVoices().length) {
      return Promise.resolve(tomar());
    }
    return new Promise((resolve) => {
      const listo = () => resolve(tomar());
      window.speechSynthesis.addEventListener("voiceschanged", listo, { once: true });
      setTimeout(listo, 600);
    });
  }

  elegirVozHumana() {
    const voces = window.speechSynthesis?.getVoices?.() || [];
    let mejor = null;
    let mejorPuntaje = -Infinity;
    for (const voz of voces) {
      const puntaje = this.puntuarVoz(voz);
      if (puntaje > mejorPuntaje) {
        mejorPuntaje = puntaje;
        mejor = voz;
      }
    }
    return mejorPuntaje > 0 ? mejor : voces.find((voz) => (voz.lang || "").toLowerCase().startsWith("es")) || null;
  }

  puntuarVoz(voz) {
    const lang = String(voz.lang || "").toLowerCase();
    const name = String(voz.name || "").toLowerCase();
    if (!lang.startsWith("es") && !/spanish|español/.test(name)) return -100;

    let score = 12;
    if (lang.startsWith("es-co")) score += 20;
    else if (lang.startsWith("es-mx") || lang.startsWith("es-us") || lang.includes("419")) score += 16;
    else if (lang.startsWith("es-ar") || lang.startsWith("es-cl") || lang.startsWith("es-pe")) score += 11;
    else if (lang.startsWith("es-es")) score += 5;

    if (/natural|neural|online|premium|enhanced|wavenet|studio|network/.test(name)) score += 34;
    if (/google/.test(name)) score += 14;
    if (/sabina|salome|salomé|dalia|paulina|mónica|monica|paloma|elvira|catalina|camila|lucía|lucia|elena|maria|maría/.test(name)) score += 16;
    if (/female|mujer/.test(name)) score += 4;
    if (voz.localService === false) score += 10;

    if (/desktop|compact|espeak/.test(name) && !/natural|online|neural/.test(name)) score -= 30;
    if (/\b(jorge|pablo|raul|raúl|gonzalo|tomas|tomás|juan|diego)\b/.test(name)) score -= 8;
    return score;
  }

  textoParaVoz(texto) {
    return String(texto || "")
      .replace(/\*\*/g, "")
      .replace(/[_#*`]/g, "")
      .replace(/\s*[-–—]\s*/g, ", ")
      .replace(/\s*\/\s*/g, " ")
      .replace(/\bOK\b/gi, "de acuerdo")
      .replace(/\s+/g, " ")
      .trim();
  }

  frasesParaVoz(texto) {
    const limpio = this.textoParaVoz(texto);
    if (!limpio) return [];
    const partes = limpio.split(/(?<=[.!?…;:])\s+/).map((parte) => parte.trim()).filter(Boolean);
    return partes.length ? partes : [limpio];
  }

  hablar(texto, { onStart, onEnd, rate, slow = false } = {}) {
    if (!window.speechSynthesis) return;
    const token = ++this.speechToken;
    window.speechSynthesis.cancel();
    const frases = this.frasesParaVoz(texto);
    if (!frases.length) {
      onEnd?.();
      return;
    }

    this.prepararVoces().then((voz) => {
      if (token !== this.speechToken) return;
      const natural = /natural|neural|online|google|premium/i.test(voz?.name || "");
      const ritmo = rate ?? (slow ? (natural ? 0.9 : 0.86) : (natural ? 0.97 : 0.92));
      this.decirFrases(frases, 0, {
        token,
        onStart,
        onEnd,
        rate: ritmo,
        pitch: natural ? 1 : 1.03,
        voice: voz
      });
    });
  }

  decirFrases(frases, index, ctx) {
    if (ctx.token !== this.speechToken) return;
    if (index >= frases.length) {
      ctx.onEnd?.();
      return;
    }

    const mensaje = new SpeechSynthesisUtterance(frases[index]);
    mensaje.lang = ctx.voice?.lang || "es-MX";
    if (ctx.voice) mensaje.voice = ctx.voice;
    mensaje.rate = ctx.rate;
    mensaje.pitch = ctx.pitch;
    mensaje.volume = 1;

    if (index === 0) mensaje.onstart = () => ctx.onStart?.();
    mensaje.onend = () => {
      if (ctx.token !== this.speechToken) return;
      if (index + 1 >= frases.length) {
        ctx.onEnd?.();
        return;
      }
      setTimeout(() => this.decirFrases(frases, index + 1, ctx), 180);
    };
    mensaje.onerror = () => {
      if (ctx.token === this.speechToken) ctx.onEnd?.();
    };

    window.speechSynthesis.speak(mensaje);
  }


  // =====================================================
  // PREGUNTAR A VITA
  // =====================================================

  preguntar(texto, hablar = true) {

    const respuesta =
      this.responder(texto);


    if (hablar) {

      this.hablar(respuesta);

    }


    return respuesta;

  }

}


// =====================================================
// INSTANCIA DE LA APP
// =====================================================

const vita = new VitaCore();
window.vita = vita;