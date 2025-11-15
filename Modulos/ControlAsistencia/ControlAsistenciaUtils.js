/**
 * Utilidades específicas para el módulo Control Asistencia
 */

function parsearFechaRobusto(dateString) {
  if (!dateString || dateString.toString().trim() === '') return null;

  const str = dateString.toString().trim();

  const partes = str.split(/[\/\-]/);

  if (partes.length >= 3) {
    try {
      const dia = parseInt(partes[0], 10);
      const mes = parseInt(partes[1], 10) - 1;
      const año = parseInt(partes[2], 10);

      if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || año < 1900 || año > 2100) {
        return null;
      }

      const espacioIndex = str.indexOf(' ');
      let fecha;

      if (espacioIndex > 0) {
        const horaParte = str.substring(espacioIndex + 1);
        const partesHora = horaParte.split(':');

        const horas = parseInt(partesHora[0] || 0, 10);
        const minutos = parseInt(partesHora[1] || 0, 10);
        const segundos = parseInt(partesHora[2] || 0, 10);

        if (horas < 0 || horas > 23 || minutos < 0 || minutos > 59 || segundos < 0 || segundos > 59) {
          return null;
        }

        fecha = new Date(año, mes, dia, horas, minutos, segundos);
      } else {
        fecha = new Date(año, mes, dia);
      }

      if (isNaN(fecha.getTime())) {
        return null;
      }

      return fecha;

    } catch (e) {
      return null;
    }
  }

  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d;
    }
  } catch (e) {
    return null;
  }

  return null;
}

function duracionA_Minutos(duracion) {
  try {
    const partes = duracion.split(':');
    if (partes.length !== 3) return 0;
    const horas = parseInt(partes[0]);
    const minutos = parseInt(partes[1]);
    const segundos = parseInt(partes[2]);
    return (horas * 60) + minutos + (segundos / 60);
  } catch {
    return 0;
  }
}

function minutos_A_FormatoHora(minutosTotal) {
  if (minutosTotal < 0) minutosTotal = 0;
  const minutosEnteros = Math.floor(minutosTotal);
  const segundosFlotantes = (minutosTotal - minutosEnteros) * 60;
  const horas = Math.floor(minutosEnteros / 60);
  const minutos = minutosEnteros % 60;
  const segundos = Math.round(segundosFlotantes);
  const pad = num => String(num).padStart(2, '0');
  return `${pad(horas)}:${pad(minutos)}:${pad(segundos === 60 ? 59 : segundos)}`;
}

function normalizarCodigoCurso(codigoCurso) {
  if (!codigoCurso || typeof codigoCurso !== 'string') return codigoCurso;

  let normalizado = codigoCurso.replace(/\s+/g, ' ').trim();

  const patronBIS = /^(\d+\/\d+)\s*([Bb]\s*[Ii]\s*[Ss])?\s*(\d*)$/;
  const match = normalizado.match(patronBIS);

  if (match) {
    const baseCode = match[1];
    const bisPart = match[2];
    const bisNumber = match[3];

    if (bisPart && bisNumber) {
      const bisLetters = bisPart.replace(/\s/g, '').toUpperCase();
      return `${baseCode} ${bisLetters} ${bisNumber}`;
    } else if (bisPart && !bisNumber) {
      const bisLetters = bisPart.replace(/\s/g, '').toUpperCase();
      return `${baseCode} ${bisLetters} 1`;
    } else if (!bisPart && bisNumber) {
      return `${baseCode} BIS ${bisNumber}`;
    } else {
      return baseCode;
    }
  }

  return normalizado;
}

function verificarAutorizacion() {
  const correoUsuario = Session.getActiveUser().getEmail();
  const idSheetAutorizados = PropertiesService.getScriptProperties().getProperty('ID_SHEET_AUTORIZADOS');
  if (!idSheetAutorizados) {
    throw new Error("ERROR DE CONFIGURACIÓN: El ID de la Hoja de Usuarios Autorizados no está definido. Contacte al administrador.");
  }

  let sheet;
  try {
    sheet = SpreadsheetApp.openById(idSheetAutorizados).getActiveSheet();
  } catch (e) {
    throw new Error("ERROR: No se pudo acceder a la Hoja de Usuarios Autorizados. Verifique el ID y permisos.");
  }

  const rangos = sheet.getDataRange().getValues();
  const correosAutorizados = rangos.map(fila => (fila[0] || '').toString().trim().toLowerCase()).filter(c => c.length > 0);
  if (correosAutorizados.includes(correoUsuario.toLowerCase())) {
    return correoUsuario;
  } else {
    const mensaje = `Acceso denegado. Su correo (${correoUsuario}) no está autorizado para usar esta herramienta.`;
    Logger.log(mensaje);
    throw new Error(mensaje);
  }
}

function arraysIguales(arr1, arr2) {
  if (!arr1 || !arr2) return false;
  if (arr1.length !== arr2.length) return false;

  for (let i = 0; i < arr1.length; i++) {
    const row1 = arr1[i];
    const row2 = arr2[i];
    if (!row1 || !row2) return false;
    if (row1.length !== row2.length) return false;

    for (let j = 0; j < row1.length; j++) {
      let val1 = String(row1[j]).trim();
      let val2 = String(row2[j]).trim();

      if (val1 === 'null' || val1 === 'undefined') val1 = '';
      if (val2 === 'null' || val2 === 'undefined') val2 = '';

      if (val1 !== val2) {
        return false;
      }
    }
  }
  return true;
}