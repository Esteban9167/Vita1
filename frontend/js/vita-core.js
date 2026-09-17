// =====================================================
// VITA CORE
// Solo funcionalidades. Sin HTML y sin CSS.
// =====================================================

class VitaCore {

  constructor() {

    this.storageKey = "vita_app_data";
    this.state = this.estadoInicial();

    this.recognition = null;
    this.listening = false;

    this.load();
    this.configurarReconocimientoVoz();
  }


  // =====================================================
  // GUARDAR / CARGAR DATOS
  // =====================================================

  save() {
    localStorage.setItem(
      this.storageKey,
      JSON.stringify(this.state)
    );
  }


  load() {

    const saved = localStorage.getItem(this.storageKey);

    if (!saved) return;

    try {

      const data = JSON.parse(saved);

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
        }
      };

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

  guardarHistoria(datos = {}) {

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

  agregarMedicamento({
    nombre,
    dosis = "",
    horarios = []
  }) {

    if (!nombre?.trim()) {
      throw new Error(
        "Debe indicar el medicamento."
      );
    }

    if (!Array.isArray(horarios)) {

      horarios = String(horarios)
        .split(",")
        .map(h => h.trim())
        .filter(Boolean);

    }


    if (horarios.length === 0) {
      throw new Error(
        "Debe indicar al menos un horario."
      );
    }


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

    this.state.medicamentos =
      this.state.medicamentos.filter(
        medicamento =>
          medicamento.id !== Number(id)
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

  hablar(
    texto,
    {
      onStart,
      onEnd,
      rate = 1
    } = {}
  ) {

    if (
      !window.speechSynthesis
    ) {

      return;

    }


    window.speechSynthesis.cancel();


    const mensaje =
      new SpeechSynthesisUtterance(
        texto
      );


    mensaje.lang =
      "es-CO";


    mensaje.rate = rate;

    mensaje.pitch = 1.05;


    const voces =
      window.speechSynthesis
        .getVoices();


    const vozEspañol =
      voces.find(
        voz =>
          voz.lang
          &&
          voz.lang.startsWith("es")
      );


    if (vozEspañol) {

      mensaje.voice =
        vozEspañol;

    }


    mensaje.onstart =
      () => onStart?.();


    mensaje.onend =
      () => onEnd?.();


    window.speechSynthesis
      .speak(mensaje);

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