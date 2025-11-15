/**
 * Servicios de Drive para el módulo Control Asistencia
 */

function obtenerOCrearCarpeta(carpetaPadre, nombreCarpeta) {
  const carpetas = carpetaPadre.getFoldersByName(nombreCarpeta);
  if (carpetas.hasNext()) {
    return carpetas.next();
  }
  return carpetaPadre.createFolder(nombreCarpeta);
}

function crearDocumentoInforme(carpetaCurso, idCurso, fechaStr, alumnosSinCorreo, alumnosNoAsistieronTexto, observacionesTexto, datosCursoFirebase) {

  const idCursoNormalizado = normalizarCodigoCurso(idCurso);

  const nombreCurso = (datosCursoFirebase && datosCursoFirebase.nombreCurso) || idCursoNormalizado;
  const fechaInicio = (datosCursoFirebase && datosCursoFirebase.fechaInicio) || 'N/A';
  const fechaFin = (datosCursoFirebase && datosCursoFirebase.fechaFin) || 'N/A';
  const centroGestor = (datosCursoFirebase && datosCursoFirebase.centroGestor) || 'N/A';
  const mailCentro = (datosCursoFirebase && datosCursoFirebase.mailCentro) || 'N/A';
  const horario = (datosCursoFirebase && datosCursoFirebase.horario) || 'N/A';
  const fecha25 = (datosCursoFirebase && datosCursoFirebase.fecha25) || 'N/A';

  const carpetaInformes = obtenerOCrearCarpeta(carpetaCurso, '6. Informes');

  const nombreBase = idCursoNormalizado.replace(/\//g, '_');
  const nombreBaseInforme = `${nombreBase} ${fechaStr} Informe`;

  // BUSCAR SI YA EXISTE UN INFORME PARA ESTA FECHA
  const consultaBusqueda = `title = '${nombreBaseInforme}' and trashed = false and mimeType='${MimeType.PLAIN_TEXT}' and '${carpetaInformes.getId()}' in parents`;
  const filesIterator = DriveApp.searchFiles(consultaBusqueda);

  let archivoInforme = null;
  
  if (filesIterator.hasNext()) {
    // SI EXISTE - REEMPLAZAR EL CONTENIDO
    archivoInforme = filesIterator.next();
    Logger.log(`Informe existente encontrado: ${archivoInforme.getName()}`);
  } else {
    // SI NO EXISTE - CREAR NUEVO
    archivoInforme = carpetaInformes.createFile(nombreBaseInforme, '', MimeType.PLAIN_TEXT);
    Logger.log(`Nuevo informe creado: ${archivoInforme.getName()}`);
  }

  let contenido = `CONTROL DE ASISTENCIAS DEL CURSO: ${nombreCurso}\n`;
  contenido += `ID DE CURSO (Código): ${idCursoNormalizado}\n`;
  contenido += `CENTRO GESTOR: ${centroGestor}\n`;
  contenido += `MAIL CENTRO: ${mailCentro}\n`;
  contenido += `HORARIO: ${horario}\n`;
  contenido += `FECHA INICIO DEL CURSO: ${fechaInicio}\n`;
  contenido += `FECHA FIN DEL CURSO: ${fechaFin}\n`;
  contenido += `FECHA FECHA_25: ${fecha25}\n`;
  contenido += `FECHA DEL REPORTE DE ASISTENCIA (Zoom): ${fechaStr}\n\n`;

  const hayNovedades = alumnosSinCorreo.length > 0 ||
    alumnosNoAsistieronTexto.trim().length > 0 ||
    observacionesTexto.trim().length > 0;

  if (!hayNovedades) {
    contenido += "EN ESTA FECHA NO SE HA TENIDO NOVEDADES EN ESTE CURSO, TODAS LAS ASISTENCIAS HAN SIDO CORRECTAS";
  } else {
    if (alumnosSinCorreo.length > 0) {
      contenido += "--------------------------------------------------------\n";
      contenido += "🛑 Alumnos sin correo (requieren revisión/registro):\n";
      contenido += alumnosSinCorreo.map(a => `- ${a}`).join('\n');
      contenido += "\n";
    }

    if (alumnosNoAsistieronTexto.trim().length > 0) {
      contenido += "--------------------------------------------------------\n";
      contenido += "🚫 Alumnos que NO Asistieron:\n";
      contenido += alumnosNoAsistieronTexto.trim().split('\n').map(linea => `- ${linea.trim()}`).join('\n');
      contenido += "\n";
    }

    if (observacionesTexto.trim().length > 0) {
      contenido += "--------------------------------------------------------\n";
      contenido += "ℹ️ Novedades / Observaciones:\n";
      contenido += observacionesTexto.trim().split('\n').map(linea => `- ${linea.trim()}`).join('\n');
      contenido += "\n";
    }
  }

  // ACTUALIZAR EL CONTENIDO DEL ARCHIVO (tanto si es nuevo como existente)
  archivoInforme.setContent(contenido);

  return {
    idInforme: archivoInforme.getId(),
    urlInforme: archivoInforme.getUrl(),
    accion: filesIterator.hasNext() ? "actualizado" : "creado"
  };
}