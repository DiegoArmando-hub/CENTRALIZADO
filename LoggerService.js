// LoggerService.gs - Versión corregida
function logAction(action, details, userId) {
  try {
    const user = userId || Session.getEffectiveUser().getEmail();
    const timestamp = new Date().toISOString();
    const ip = getUserIP();
    
    const logEntry = {
      timestamp: timestamp,
      user: user,
      action: action,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      ip: ip,
      userAgent: getUserAgent()
    };
    
    // Guardar en sheet local
    logToSheet(logEntry);
    
    console.log('LOG:', action, '- Usuario:', user);
    
  } catch (error) {
    console.error('Error en logAction:', error);
  }
}

function getUserIP() {
  try {
    return Session.getTemporaryActiveUserKey() || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function getUserAgent() {
  try {
    return Session.getScriptTimeZone() || 'unknown';
  } catch (e) {
    return 'unknown';
  }
}

function logToSheet(logEntry) {
  try {
    const config = getConfig();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(config.sheets.logs);
    
    if (!sheet) {
      // Si no existe la hoja, la creamos
      sheet = ss.insertSheet(config.sheets.logs);
      // Configurar headers
      sheet.getRange(1, 1, 1, 6).setValues([['Timestamp', 'Usuario', 'IP', 'Acción', 'Detalles', 'UserAgent']]);
    }
    
    // Agregar nueva fila
    sheet.appendRow([
      logEntry.timestamp,
      logEntry.user,
      logEntry.ip,
      logEntry.action,
      logEntry.details,
      logEntry.userAgent
    ]);
    
  } catch (error) {
    console.error('Error guardando log en sheet:', error);
  }
}