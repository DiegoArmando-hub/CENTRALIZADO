function logAction(action, details, clientIP) {
  try {
    console.log('Guardando log - IP:', clientIP);
    
    const user = getCurrentUser() || { email: 'unknown' };
    const now = new Date();
    const timestamp = formatDateLegible(now);
    
    const logEntry = {
      timestamp: timestamp,
      user: user.email,
      action: action,
      details: details,
      ip: clientIP || getClientIP(),
      userAgent: Session.getScriptTimeZone() || 'unknown'
    };
    
    // Log to Firebase
    logToFirebase(logEntry);
    
    // Log to Sheet
    logToSheet(logEntry);
    
  } catch (error) {
    console.error('Error en logger:', error);
  }
}

// ✅ FUNCIÓN PARA FECHA LEGIBLE EN ESPAÑOL
function formatDateLegible(date) {
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 
                 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  
  const day = String(date.getDate()).padStart(2, '0');
  const month = meses[date.getMonth()];
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

function logToFirebase(logEntry) {
  try {
    FirebaseService.getInstance().create('system_logs', logEntry);
  } catch (error) {
    console.error('Error Firebase:', error);
  }
}

function logToSheet(logEntry) {
  try {
    const config = getConfig();
    if (!config.sheets.logs) return;
    
    const logSheet = SpreadsheetApp.openById(config.sheets.logs);
    const sheet = logSheet.getSheets()[0];
    
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, 5).setValues([[
        'Timestamp', 'Usuario', 'Acción', 'Detalles', 'IP'
      ]]);
    }
    
    sheet.appendRow([
      logEntry.timestamp,
      logEntry.user,
      logEntry.action,
      logEntry.details,
      logEntry.ip
    ]);
    
    console.log('Log guardado - IP:', logEntry.ip);
    
  } catch (error) {
    console.error('Error Sheet:', error);
  }
}

// ✅ FUNCIÓN DE RESPALDO (cuando no hay IP del cliente)
function getClientIP() {
  try {
    return Session.getTemporaryActiveUserKey();
  } catch (e) {
    return 'unknown';
  }
}