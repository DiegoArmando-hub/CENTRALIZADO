/**
 * Servicios específicos para el módulo Control Asistencia
 * Maneja Firebase, rate limiting, y lógica de negocio
 */

// =======================================================
// CONTROL DE TASA PARA FIREBASE
// =======================================================

let rateLimiters = {};

function controlarTasaConsulta() {
  const timeKey = Math.floor(Date.now() / 1000);
  
  if (!rateLimiters[timeKey]) {
    rateLimiters[timeKey] = {
      contadorConsultas: 0,
      timestampInicio: Date.now(),
      MAX_CONSULTAS_POR_SEGUNDO: 3
    };
    cleanupOldRateLimiters();
  }
  
  const limiter = rateLimiters[timeKey];
  const ahora = Date.now();
  const ventanaTiempo = ahora - limiter.timestampInicio;

  if (ventanaTiempo > 1000) {
    limiter.contadorConsultas = 0;
    limiter.timestampInicio = ahora;
  }

  if (limiter.contadorConsultas >= limiter.MAX_CONSULTAS_POR_SEGUNDO) {
    const tiempoEspera = 1000 - ventanaTiempo + 100;
    if (tiempoEspera > 0) {
      Utilities.sleep(tiempoEspera);
      limiter.contadorConsultas = 0;
      limiter.timestampInicio = Date.now();
    }
  }

  limiter.contadorConsultas++;
}

function cleanupOldRateLimiters() {
  const ahora = Date.now();
  const keys = Object.keys(rateLimiters);
  
  for (const key of keys) {
    if (ahora - rateLimiters[key].timestampInicio > 5000) {
      delete rateLimiters[key];
    }
  }
}

// =======================================================
// FUNCIONES PRINCIPALES DEL MÓDULO
// =======================================================

function procesarArchivoCargado(datosFormulario) {
  // verificarAutorizacion(); // Eliminado a petición del usuario
  const contenido = datosFormulario.excelContent;
  if (!contenido) throw new Error("No se ha cargado ningún archivo.");

  let datos = Utilities.parseCsv(contenido, ',');
  if (datos.length < 2) throw new Error("El archivo debe contener al menos una fila de datos.");

  datos = datos.filter((fila, idx) => idx === 0 || (fila[2] && fila[2].trim() !== ''));
  const encabezado = datos.shift();

  // BUSCAR ÍNDICES DE COLUMNAS "NOMBRE" Y "APELLIDO" - VERSIÓN MEJORADA
  const indiceNombre = encabezado.findIndex(col =>
    col && col.toString().toLowerCase().includes('nombre'));
  const indiceApellido = encabezado.findIndex(col =>
    col && col.toString().toLowerCase().includes('apellido'));

  encabezado[8] = 'MINUTOS';
  for (let i = 0; i < datos.length; i++) {
    const minutos = duracionA_Minutos(datos[i][7]);
    datos[i][8] = Math.round(minutos * 1000) / 1000;
  }

  const datosConEncabezado = [encabezado, ...datos];
  const mapSumas = new Map();
  const mapTieneCorreo = new Map();
  const mapTipoEspecial = new Map();

  let debugCount = 0;
  datos.forEach((fila) => {
    const nombre = fila[2];
    const correo = fila[1];

    const nombreUpper = nombre.toUpperCase();

    // Tipo 1: Empieza con palabras especiales (AMARILLO)
    const esEspecialTipo1 = /^(SOPORTE|INFORMACIÓN|COORDINACI|GESTOR|DOCENTE|INFO)/i.test(nombreUpper);

    // Tipo 2: CASO FORTUITO - Nombre completo normal pero columnas NOMBRE/APELLIDO contienen DOCENTE (ROJO)
    let esCasoFortuito = false;
    if (indiceNombre !== -1 && indiceApellido !== -1) {
      const valorNombre = (fila[indiceNombre] || '').toString().toUpperCase();
      const valorApellido = (fila[indiceApellido] || '').toString().toUpperCase();
      const nombreCompletoNormal = !esEspecialTipo1;

      if (nombreCompletoNormal &&
        (valorNombre.includes('DOCENTE') || valorApellido.includes('DOCENTE'))) {
        esCasoFortuito = true;
      }
    }

    const esEspecial = esEspecialTipo1 || esCasoFortuito;

    // 🆕 CORRECCIÓN: Asignar correctamente el tipo especial
    let tipoEspecial = 'normal';
    if (esCasoFortuito) {
      tipoEspecial = 'tipo2'; // ROJO - Caso fortuito (prioridad máxima)
    } else if (esEspecialTipo1) {
      tipoEspecial = 'tipo1'; // AMARILLO - Palabras especiales
    }

    mapSumas.set(nombre, (mapSumas.get(nombre) || 0) + fila[8]);
    mapTipoEspecial.set(nombre, tipoEspecial);

    if (!esEspecial) {
      if ((correo || '').trim().length > 0) {
        mapTieneCorreo.set(nombre, true);
      } else if (!mapTieneCorreo.has(nombre)) {
        mapTieneCorreo.set(nombre, false);
      }
    } else {
      mapTieneCorreo.set(nombre, true);
    }
  });

  const datosProcesados = Array.from(mapSumas.entries()).map(([nombre, minutos]) => {
    const nombreUpper = nombre.toUpperCase();
    const esEspecialTipo1 = /^(SOPORTE|INFORMACIÓN|COORDINACI|GESTOR|DOCENTE|INFO)/i.test(nombreUpper);

    // Buscar en los datos originales para detectar caso fortuito
    let esCasoFortuito = false;
    if (indiceNombre !== -1 && indiceApellido !== -1) {
      const filaOriginal = datos.find(fila => fila[2] === nombre);
      if (filaOriginal) {
        const valorNombre = (filaOriginal[indiceNombre] || '').toString().toUpperCase();
        const valorApellido = (filaOriginal[indiceApellido] || '').toString().toUpperCase();
        const nombreCompletoNormal = !esEspecialTipo1;

        if (nombreCompletoNormal &&
          (valorNombre.includes('DOCENTE') || valorApellido.includes('DOCENTE'))) {
          esCasoFortuito = true;
        }
      }
    }

    let tipoEspecial = 'normal';
    if (esCasoFortuito) {
      tipoEspecial = 'tipo2'; // ROJO - Caso fortuito (prioridad máxima)
    } else if (esEspecialTipo1) {
      tipoEspecial = 'tipo1'; // AMARILLO - Palabras especiales
    }

    return {
      nombre,
      minutos_totales: minutos,
      horas_totales: minutos_A_FormatoHora(minutos),
      esEspecial: esEspecialTipo1 || esCasoFortuito,
      tipoEspecial: tipoEspecial,
      tieneCorreo: mapTieneCorreo.get(nombre) || false
    };
  });

  datosProcesados.sort((a, b) => {
    if (a.esEspecial && b.esEspecial) return a.nombre.localeCompare(b.nombre);
    if (!a.esEspecial && !b.esEspecial) return a.nombre.localeCompare(b.nombre);
    return a.esEspecial ? 1 : -1;
  });

  // OBTENER OBSERVACIONES Y ALUMNOS NO ASISTIERON EXISTENTES PARA ESTA FECHA
  let observacionesExistentes = [];
  let alumnosNoAsistieronExistentes = '';
  try {
    const courseId = datosFormulario.courseId;
    if (courseId && courseId.trim() !== '') {
      // Calcular la fecha del archivo
      let fechas = [];
      for (let i = 1; i < datosConEncabezado.length; i++) {
        let fechaInicio = parsearFechaRobusto(datosConEncabezado[i][5]);
        let fechaFin = parsearFechaRobusto(datosConEncabezado[i][6]);
        if (fechaInicio) fechas.push(fechaInicio);
        if (fechaFin) fechas.push(fechaFin);
      }

      if (fechas.length > 0) {
        fechas.sort((a, b) => a - b);
        const fechaMin = fechas[0];
        const timezone = Session.getScriptTimeZone();
        const fechaStr = Utilities.formatDate(fechaMin, timezone, 'dd-MM-yyyy');

        // 🎯 UNA SOLA CONSULTA PARA TODOS LOS DATOS
        const resultadoCompleto = obtenerDatosCompletosCurso(courseId, fechaStr);
        observacionesExistentes = resultadoCompleto.observacionesExistentes || [];
        alumnosNoAsistieronExistentes = resultadoCompleto.alumnosNoAsistieronExistentes || '';
      }
    }
  } catch (e) {
    Logger.log("Error al obtener datos existentes: " + e.toString());
    // No lanzamos error, solo continuamos
  }

  return {
    resumen: datosProcesados,
    detallesCrudos: datosConEncabezado,
    observacionesExistentes: observacionesExistentes,
    alumnosNoAsistieronExistentes: alumnosNoAsistieronExistentes
  };
}

function finalizarRevisionYGuardar(
  idCurso,
  convocatoria,
  datosCrudos,
  datosProcesados,
  alumnosSinCorreo,
  alumnosNoAsistieronTexto,
  observacionesTexto,
  datosCursoFirebase
) {
  // verificarAutorizacion(); // Eliminado a petición del usuario
  const idCarpetaRaiz = PropertiesService.getScriptProperties().getProperty('CARPETA_AULA_VIRTUAL');
  if (!idCarpetaRaiz) throw new Error('No se encontró la propiedad CARPETA_AULA_VIRTUAL. Configúrala en Propiedades del proyecto.');
  if (!idCurso || !convocatoria) throw new Error('Faltan parámetros: idCurso y/o convocatoria.');

  const carpetaRaiz = DriveApp.getFolderById(idCarpetaRaiz);

  if (!datosCrudos || !datosProcesados || datosCrudos.length === 0) {
    throw new Error('Error de comunicación: No hay datos procesados en la sesión actual para exportar. Intente procesar el archivo nuevamente.');
  }

  const datosAdicionales = datosCursoFirebase || {
    nombreCurso: idCurso,
    convocatoriaCurso: convocatoria,
    empresa: 'N/A',
    fechaInicio: 'N/A',
    fechaFin: 'N/A',
    centroGestor: 'N/A',
    mailCentro: 'N/A',
    horario: 'N/A',
    fecha25: 'N/A',
    docente: 'N/A',
    expediente: 'N/A',
    sector: 'N/A',
    hf: 'N/A',
    horasDiarias: 'N/A',
    accion: 'N/A',
    enlaceAula: 'N/A'
  };

  let fechas = [];
  for (let i = 1; i < datosCrudos.length; i++) {
    let fechaInicio = parsearFechaRobusto(datosCrudos[i][5]);
    let fechaFin = parsearFechaRobusto(datosCrudos[i][6]);

    if (fechaInicio) {
      fechas.push(fechaInicio);
    }
    if (fechaFin) {
      fechas.push(fechaFin);
    }
  }

  if (fechas.length === 0) {
    throw new Error('No se encontraron fechas válidas en los datos.');
  }

  fechas.sort((a, b) => a - b);
  const fechaMin = fechas[0];
  const timezone = Session.getScriptTimeZone();
  const fechaStr = Utilities.formatDate(fechaMin, timezone, 'dd-MM-yyyy');

  const idCursoNormalizado = normalizarCodigoCurso(idCurso);

  const carpetaConvocatoria = obtenerOCrearCarpeta(carpetaRaiz, convocatoria);
  const carpetaCurso = obtenerOCrearCarpeta(carpetaConvocatoria, idCursoNormalizado);
  
  const NOMBRES_SUBCARPETAS = [
    '1. Zoom Original',
    '2. Zoom Plataforma',
    '3. Evaluación',
    '4. Cuestionario',
    '5. Copia Moodle',
    '6. Informes'
  ];
  
  NOMBRES_SUBCARPETAS.forEach(nombre => obtenerOCrearCarpeta(carpetaCurso, nombre));
  const carpetaDestino = obtenerOCrearCarpeta(carpetaCurso, '2. Zoom Plataforma');

  const encabezadosResumen = ['Nombre completo', 'Minutos Totales', 'Horas Totales (HH:mm:ss)'];
  const resumenData = datosProcesados.map(d => [d.nombre, d.minutos_totales, d.horas_totales]);
  const hojaResumenData = [encabezadosResumen, ...resumenData];

  const encabezadosDetalle = datosCrudos[0].slice();
  encabezadosDetalle.push('Horas Totales (HH:mm:ss)');
  const detallesData = datosCrudos.slice(1).map(fila => {
    const horasStr = minutos_A_FormatoHora(fila[8] || 0);
    const filaExtendida = fila.slice();
    filaExtendida.push(horasStr);
    return filaExtendida;
  });
  const hojaDetallesData = [encabezadosDetalle, ...detallesData];

  const nombreCursoSanitizado = idCursoNormalizado.replace(/\//g, '_');
  const nombreBaseArchivo = nombreCursoSanitizado + ' ' + fechaStr;

  const consultaBusqueda = `title contains '${nombreBaseArchivo}' and trashed = false and mimeType='${MimeType.GOOGLE_SHEETS}' and '${carpetaDestino.getId()}' in parents`;
  const filesIterator = DriveApp.searchFiles(consultaBusqueda);

  let archivosCoincidentes = 0;
  while (filesIterator.hasNext()) {
    filesIterator.next();
    archivosCoincidentes++;
  }

  const nextIndex = archivosCoincidentes;
  const sufijo = (nextIndex > 0) ? `_${nextIndex}` : '';
  const nombreArchivoACrear = `${nombreBaseArchivo}${sufijo}`;

  const libroFinal = SpreadsheetApp.create(nombreArchivoACrear);

  const hojaResumen = libroFinal.getActiveSheet();
  hojaResumen.setName('Resumen Agrupado');
  hojaResumen.getRange(1, 1, hojaResumenData.length, encabezadosResumen.length).setValues(hojaResumenData);
  hojaResumen.getRange(1, 1, 1, encabezadosResumen.length).setFontWeight('bold').setBackground('#041D3B').setFontColor('white');
  hojaResumen.autoResizeColumns(1, encabezadosResumen.length);
  hojaResumen.setFrozenRows(1);

  const hojaDetalles = libroFinal.insertSheet('Detalles por Alumno');
  hojaDetalles.getRange(1, 1, hojaDetallesData.length, encabezadosDetalle.length).setValues(hojaDetallesData);
  hojaDetalles.getRange(1, 1, 1, encabezadosDetalle.length).setFontWeight('bold').setBackground('#041D3B').setFontColor('white');
  hojaDetalles.autoResizeColumns(1, encabezadosDetalle.length);
  hojaDetalles.setFrozenRows(1);

  const archivo = DriveApp.getFileById(libroFinal.getId());
  archivo.moveTo(carpetaDestino);

  // 🆕 CREAR EL INFORME PRIMERO (para tener la URL)
  const informe = crearDocumentoInforme(
    carpetaCurso, idCursoNormalizado, fechaStr, alumnosSinCorreo, alumnosNoAsistieronTexto, observacionesTexto, datosAdicionales
  );

  // GUARDAR OBSERVACIONES Y ALUMNOS NO ASISTIERON EN FIREBASE SI HAY CONTENIDO (DESPUÉS de crear el informe)
  let resultadoObservaciones = null;
  if ((observacionesTexto && observacionesTexto.trim().length > 0) || (alumnosNoAsistieronTexto && alumnosNoAsistieronTexto.trim().length > 0)) {
    try {
      // Guardar texto limpio y link por separado
      const observacionLimpia = observacionesTexto ? observacionesTexto.trim() : '';
      const alumnosNoAsistieronLimpio = alumnosNoAsistieronTexto ? alumnosNoAsistieronTexto.trim() : '';

      let linkInforme = null;

      // Solo guardar el link si tenemos la URL del informe
      if (informe && informe.urlInforme) {
        linkInforme = informe.urlInforme;
      }

      // 🆕 Pasar ambos textos a Firebase
      resultadoObservaciones = actualizarObservacionesCurso(
        idCurso,
        observacionLimpia,
        fechaStr,
        linkInforme,
        alumnosNoAsistieronLimpio
      );
    } catch (e) {
      Logger.log("Error al guardar observaciones en Firebase: " + e.toString());
      // No lanzamos error para no interrumpir el proceso principal
    }
  }

  const urlCarpetaDestino = carpetaDestino.getUrl();

  //  Mensaje adicional si se guardaron observaciones
  let mensajeObservaciones = '';
  if (resultadoObservaciones) {
    if (resultadoObservaciones.success) {
      mensajeObservaciones = `\n\n📝 Observación guardada correctamente.`;
    } else {
      mensajeObservaciones = `\n\n⚠️ Las observaciones no se pudieron guardar en Firebase: ${resultadoObservaciones.mensaje}`;
    }
  }

  return {
    mensaje: `✔️ ¡Proceso completado con éxito!${mensajeObservaciones}`,
    idArchivo: libroFinal.getId(),
    urlArchivo: libroFinal.getUrl(),
    urlCarpetaDestino: urlCarpetaDestino,
    urlInforme: informe.urlInforme,
    datosAdicionales: datosAdicionales,
    observacionesGuardadas: resultadoObservaciones ? resultadoObservaciones.success : false
  };
}

// =======================================================
// SERVICIOS FIREBASE PARA CONTROL ASISTENCIA - CORREGIDOS
// =======================================================

function obtenerDatosCompletosCurso(docId, fechaRequerida = null) {
  try {
    controlarTasaConsulta();

    if (!docId || docId.trim() === '') {
      throw new Error("El ID del curso está vacío.");
    }

    // ✅ USA TU FirebaseService CENTRALIZADO PERO CON LA ESTRUCTURA ORIGINAL
    const firebaseService = FirebaseService.getInstance();
    const cursoData = firebaseService.get('db_cursos', docId);
    
    if (!cursoData) {
      throw new Error(`Curso no válido: El ID "${docId}" no contiene información.`);
    }

    console.log('Datos crudos de Firebase:', JSON.stringify(cursoData, null, 2));

    // 🎯 ADAPTAR A LA ESTRUCTURA ORIGINAL DE TU PROYECTO
    const datosCurso = {
      // Campos directos (como en tu proyecto original)
      nombreCurso: cursoData['CURSO'] || cursoData['nombreCurso'] || '',
      convocatoria: cursoData['CONVOCATORIA'] || cursoData['convocatoria'] || '',
      empresa: cursoData['EMPRESA'] || cursoData['empresa'] || '',
      fechaInicio: cursoData['FECHA_INI'] || cursoData['fechaInicio'] || '',
      fechaFin: cursoData['FECHA_FIN'] || cursoData['fechaFin'] || '',
      centroGestor: cursoData['CENTRO'] || cursoData['centroGestor'] || '',
      mailCentro: cursoData['MAIL_CENTRO'] || cursoData['mailCentro'] || '',
      horario: cursoData['HORARIO'] || cursoData['horario'] || '',
      fecha25: cursoData['FECHA_25'] || cursoData['fecha25'] || '',
      docente: cursoData['DOCENTE'] || cursoData['docente'] || '',
      expediente: cursoData['EXPEDIENTE'] || cursoData['expediente'] || '',
      sector: cursoData['SECTOR'] || cursoData['sector'] || '',
      hf: cursoData['HF'] || cursoData['hf'] || '',
      horasDiarias: cursoData['HORAS_DIARIAS'] || cursoData['horasDiarias'] || '',
      accion: cursoData['ACCIÓN'] || cursoData['accion'] || '',
      enlaceAula: cursoData['ENLACE_AULA'] || cursoData['enlaceAula'] || '',
      
      // Observaciones
      observaciones: cursoData['observaciones'] || [],

      // Links (estructura compatible)
      links: {
        linkAulaVirtual: cursoData['linkAulaVirtual'] || 
                         cursoData['links']?.linkAulaVirtual || 
                         cursoData['ENLACE_AULA'] || 
                         cursoData['enlaceAula'] || '',
        linkERP: cursoData['linkERP'] || 
                 cursoData['links']?.linkERP || '',
        linkAsistencias: cursoData['linkAsistencias'] || 
                        cursoData['links']?.linkAsistencias || ''
      }
    };

    console.log('Datos curso procesados:', JSON.stringify(datosCurso, null, 2));

    // 🎯 EXTRAER OBSERVACIONES PARA LA FECHA REQUERIDA
    let observacionesExistentes = [];
    let alumnosNoAsistieronExistentes = '';
    
    if (fechaRequerida && datosCurso.observaciones) {
      const resultadoObservaciones = extraerObservacionesPorFecha(
        datosCurso.observaciones, 
        fechaRequerida
      );
      
      observacionesExistentes = resultadoObservaciones.observaciones;
      alumnosNoAsistieronExistentes = resultadoObservaciones.alumnosNoAsistieron;
    }

    return {
      datosCurso: datosCurso,
      observacionesExistentes: observacionesExistentes,
      alumnosNoAsistieronExistentes: alumnosNoAsistieronExistentes,
      fechaConsulta: fechaRequerida,
      encontrado: true
    };

  } catch (e) {
    console.error("Error en obtenerDatosCompletosCurso: " + e.toString());
    
    if (e.message.includes('ID no encontrado') ||
        e.message.includes('El ID del curso está vacío') ||
        e.message.includes('Curso no válido')) {
      throw e;
    }

    throw new Error("Error al conectar con Firebase: " + e.message);
  }
}

// FUNCIÓN ALTERNATIVA - USA FIREBASE DIRECTAMENTE (como tu proyecto original)
function obtenerDatosCompletosCurso_Directo(docId, fechaRequerida = null) {
  try {
    controlarTasaConsulta();

    if (!docId || docId.trim() === '') {
      throw new Error("El ID del curso está vacío.");
    }

    // 🔄 ALTERNATIVA: Usar Firebase directamente como en tu proyecto original
    const token = getFirebaseToken();
    let safeDocId = docId.trim();
    safeDocId = encodeURIComponent(safeDocId);

    const config = getConfig();
    const READ_ENDPOINT = `${config.firebase.endpoint}/${safeDocId}`;
    
    const options = { 
      method: "get", 
      headers: { Authorization: "Bearer " + token },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(READ_ENDPOINT, options);
    
    if (response.getResponseCode() === 404) {
      throw new Error(`ID no encontrado: "${docId}" no existe en la base de datos.`);
    }
    
    if (response.getResponseCode() !== 200) {
      throw new Error(`Error de Firebase: ${response.getResponseCode()}`);
    }
    
    const data = JSON.parse(response.getContentText());

    if (!data.fields) {
      throw new Error(`Curso no válido: El ID "${docId}" no contiene información.`);
    }

    // 🎯 USAR LA FUNCIÓN DE APLANAMIENTO ORIGINAL
    const cursoData = aplanarDocumentoFirestoreOriginal(data.fields);
    
    console.log('Datos curso (directo):', JSON.stringify(cursoData, null, 2));

    // 🎯 ESTRUCTURA ORIGINAL DE TU PROYECTO
    const datosCurso = {
      nombreCurso: cursoData['CURSO'] || '',
      convocatoria: cursoData['CONVOCATORIA'] || '',
      empresa: cursoData['EMPRESA'] || '',
      fechaInicio: cursoData['FECHA_INI'] || '',
      fechaFin: cursoData['FECHA_FIN'] || '',
      centroGestor: cursoData['CENTRO'] || '',
      mailCentro: cursoData['MAIL_CENTRO'] || '',
      horario: cursoData['HORARIO'] || '',
      fecha25: cursoData['FECHA_25'] || '',
      docente: cursoData['DOCENTE'] || '',
      expediente: cursoData['EXPEDIENTE'] || '',
      sector: cursoData['SECTOR'] || '',
      hf: cursoData['HF'] || '',
      horasDiarias: cursoData['HORAS_DIARIAS'] || '',
      accion: cursoData['ACCIÓN'] || '',
      enlaceAula: cursoData['ENLACE_AULA'] || '',
      observaciones: cursoData['observaciones'] || [],

      links: {
        linkAulaVirtual: cursoData['linkAulaVirtual'] || cursoData['ENLACE_AULA'] || '',
        linkERP: cursoData['linkERP'] || '',
        linkAsistencias: cursoData['linkAsistencias'] || ''
      }
    };

    // 🎯 EXTRAER OBSERVACIONES PARA LA FECHA REQUERIDA
    let observacionesExistentes = [];
    let alumnosNoAsistieronExistentes = '';
    
    if (fechaRequerida && datosCurso.observaciones) {
      const resultadoObservaciones = extraerObservacionesPorFecha(
        datosCurso.observaciones, 
        fechaRequerida
      );
      
      observacionesExistentes = resultadoObservaciones.observaciones;
      alumnosNoAsistieronExistentes = resultadoObservaciones.alumnosNoAsistieron;
    }

    return {
      datosCurso: datosCurso,
      observacionesExistentes: observacionesExistentes,
      alumnosNoAsistieronExistentes: alumnosNoAsistieronExistentes,
      fechaConsulta: fechaRequerida,
      encontrado: true
    };

  } catch (e) {
    console.error("Error en obtenerDatosCompletosCurso_Directo: " + e.toString());
    throw new Error("Error al conectar con Firebase: " + e.message);
  }
}

// 🎯 FUNCIÓN DE APLANAMIENTO ORIGINAL (de tu proyecto)
function aplanarDocumentoFirestoreOriginal(fields) {
  const result = {};
  for (const key in fields) {
    if (fields.hasOwnProperty(key)) {
      const field = fields[key];
      if (field.hasOwnProperty('stringValue')) {
        result[key] = field.stringValue;
      }
      else if (field.hasOwnProperty('integerValue')) {
        result[key] = parseInt(field.integerValue);
      }
      else if (field.hasOwnProperty('booleanValue')) {
        result[key] = field.booleanValue;
      }
      else if (field.hasOwnProperty('timestampValue')) {
        result[key] = new Date(field.timestampValue).toLocaleString();
      }
      else if (field.hasOwnProperty('mapValue')) {
        if (key === 'links') {
          const linksFields = aplanarDocumentoFirestoreOriginal(field.mapValue.fields);
          result['linkAulaVirtual'] = linksFields['linkAulaVirtual'] || '';
          result['linkERP'] = linksFields['linkERP'] || '';
          result['linkAsistencias'] = linksFields['linkAsistencias'] || '';
        } else {
          result[key] = aplanarDocumentoFirestoreOriginal(field.mapValue.fields);
        }
      }
      else if (field.hasOwnProperty('arrayValue')) {
        if (field.arrayValue.values) {
          result[key] = field.arrayValue.values.map(item => {
            if (item.mapValue) {
              return aplanarDocumentoFirestoreOriginal(item.mapValue.fields);
            } else {
              return item;
            }
          });
        } else {
          result[key] = [];
        }
      }
      else {
        result[key] = JSON.stringify(field);
      }
    }
  }
  return result;
}

// 🎯 FUNCIÓN PARA OBTENER TOKEN (de tu proyecto original)
function getFirebaseToken() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'firebase_token_global';
  
  const cachedToken = cache.get(cacheKey);
  if (cachedToken) {
    console.log('✅ Token from global cache');
    return cachedToken;
  }
  
  const serviceAccountKey = PropertiesService.getScriptProperties().getProperty('FIREBASE_SECRET');
  if (!serviceAccountKey) {
    throw new Error("ERROR: La propiedad 'FIREBASE_SECRET' no está configurada.");
  }
  
  const key = JSON.parse(serviceAccountKey);
  const jwtPayload = {
    iss: key.client_email,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000)
  };
  
  const jwtHeader = { alg: "RS256", typ: "JWT" };
  const header = Utilities.base64EncodeWebSafe(JSON.stringify(jwtHeader));
  const payload = Utilities.base64EncodeWebSafe(JSON.stringify(jwtPayload));
  const toSign = header + "." + payload;
  const signature = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(toSign, key.private_key)
  );
  const jwt = toSign + "." + signature;
  
  const options = {
    method: "post",
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }
  };
  
  const response = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", options);
  const data = JSON.parse(response.getContentText());
  
  if (!data.access_token) {
    throw new Error("Fallo al obtener el token de Firebase.");
  }
  
  cache.put(cacheKey, data.access_token, 3300);
  
  console.log('🔄 Nuevo token generado (cache global)');
  return data.access_token;
}

// =======================================================
// FUNCIONES DE COMPATIBILIDAD - ACTUALIZADAS
// =======================================================

function consultarCursoPorID(docId) {
  try {
    // Primero intenta con el método directo (como tu proyecto original)
    const resultado = obtenerDatosCompletosCurso_Directo(docId);
    return resultado.datosCurso;
  } catch (error) {
    console.log('Método directo falló, intentando con servicio:', error.message);
    // Si falla, intenta con el servicio centralizado
    const resultado = obtenerDatosCompletosCurso(docId);
    return resultado.datosCurso;
  }
}

function verificarEstadoProteccion() {
  const timeKey = Math.floor(Date.now() / 1000);
  
  if (!rateLimiters[timeKey]) {
    return {
      estado: "INACTIVO",
      mensaje: "No hay consultas recientes"
    };
  }
  
  const limiter = rateLimiters[timeKey];
  const ahora = Date.now();
  const ventanaTiempo = ahora - limiter.timestampInicio;
  const estado = limiter.contadorConsultas >= limiter.MAX_CONSULTAS_POR_SEGUNDO ? "PROTEGIENDO" : "NORMAL";

  return {
    contadorActual: limiter.contadorConsultas,
    maxConsultasPorSegundo: limiter.MAX_CONSULTAS_POR_SEGUNDO,
    ventanaTiempoMs: ventanaTiempo,
    estado: estado,
    timestamp: new Date(limiter.timestampInicio).toISOString()
  };
}