function doGet() {
  if (!isUserAuthenticated()) {
    return renderLoginPage();
  }
  return renderMainPage();
}

function doPost(e) {
  return doGet(e);
}

function renderLoginPage() {
  const html = HtmlService.createTemplateFromFile('Login')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('Login - Sistema Gestión Educativa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  return html;
}

function renderMainPage() {
  const html = HtmlService.createTemplateFromFile('Main')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('Sistema Gestión Educativa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  return html;
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ✅ MANTENER función original para compatibilidad
function login(usuarioInput, password) {
  return validateUser(usuarioInput, password);
}

// ✅ NUEVA FUNCIÓN CON IP
function loginWithIP(usuarioInput, password, clientIP) {
  const result = validateUser(usuarioInput, password);
  if (result.success) {
    // Log con IP real
    logAction('LOGIN_SUCCESS', `Usuario ${result.user.alias} autenticado (usó: ${usuarioInput})`, clientIP);
  } else {
    logAction('LOGIN_FAILED', `Intento fallido para: ${usuarioInput}`, clientIP);
  }
  return result;
}

function logout() {
  return logoutUser();
}

function getUserInfo() {
  return getCurrentUser();
}

// ✅ MANTENER función original para compatibilidad
function openModule(moduleName) {
  const user = getCurrentUser();
  logAction('MODULE_ACCESS', `Accedió al módulo: ${moduleName}`);
  
  switch(moduleName) {
    case 'CONTROL_ASISTENCIA':
      return 'Módulo Control Asistencia abierto';
    case 'GESTION_ALUMNOS':
      return 'Módulo Gestión Alumnos abierto';
    case 'SEGUIMIENTO_CURSOS':
      return 'Módulo Seguimiento Cursos abierto';
    case 'GESTION_CURSOS':
      return 'Módulo Gestión Cursos abierto';
    default:
      throw new Error('Módulo no encontrado');
  }
}

// ✅ NUEVA FUNCIÓN CON IP
function openModuleWithIP(moduleName, clientIP) {
  const user = getCurrentUser();
  logAction('MODULE_ACCESS', `Accedió al módulo: ${moduleName}`, clientIP);
  
  switch(moduleName) {
    case 'CONTROL_ASISTENCIA':
      return 'Módulo Control Asistencia abierto';
    case 'GESTION_ALUMNOS':
      return 'Módulo Gestión Alumnos abierto';
    case 'SEGUIMIENTO_CURSOS':
      return 'Módulo Seguimiento Cursos abierto';
    case 'GESTION_CURSOS':
      return 'Módulo Gestión Cursos abierto';
    default:
      throw new Error('Módulo no encontrado');
  }
}

function testSystem() {
  try {
    const config = getConfig();
    const user = getCurrentUser();
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
      config: {
        firebase: !!config.firebase.projectId,
        sheets: {
          usuarios: !!config.sheets.usuarios,
          logs: !!config.sheets.logs,
          parametros: !!config.sheets.parametros
        }
      },
      user: user
    };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

function isUserAuthenticated() {
  return getCurrentUser() !== null;
}

function getCurrentUser() {
  const cache = CacheService.getScriptCache();
  const userData = cache.get('current_user');
  return userData ? JSON.parse(userData) : null;
}

function validateUser(usuarioInput, password) {
  try {
    const config = getConfig();
    if (!config.sheets.usuarios) {
      return { success: false, message: 'Sheet de usuarios no configurada' };
    }
    
    const userSheet = SpreadsheetApp.openById(config.sheets.usuarios);
    const data = userSheet.getDataRange().getValues();
    const headers = data[0];
    
    const emailIndex = headers.indexOf('correo');
    const passwordIndex = headers.indexOf('contraseña');
    const nameIndex = headers.indexOf('Nombre');
    const aliasIndex = headers.indexOf('alias');
    
    if (emailIndex === -1 || passwordIndex === -1) {
      return { success: false, message: 'Estructura de sheet incorrecta' };
    }
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const userEmail = row[emailIndex];
      const userAlias = row[aliasIndex];
      const userPassword = row[passwordIndex];
      
      // ✅ ACEPTA ALIAS O CORREO
      if ((userEmail === usuarioInput || userAlias === usuarioInput) && userPassword === password) {
        const userData = {
          email: userEmail,
          name: row[nameIndex] || userEmail,
          alias: userAlias || userEmail.split('@')[0],
          loginTime: new Date().toISOString()
        };
        
        setUserSession(userData);
        return { success: true, user: userData };
      }
    }
    
    return { success: false, message: 'Credenciales incorrectas' };
    
  } catch (error) {
    console.error('Auth Error:', error);
    return { success: false, message: 'Error del sistema' };
  }
}

function setUserSession(userData) {
  const cache = CacheService.getScriptCache();
  const config = getConfig();
  cache.put('current_user', JSON.stringify(userData), config.app.timeout * 60);
}

function logoutUser() {
  const user = getCurrentUser();
  CacheService.getScriptCache().remove('current_user');
  
  if (user) {
    logAction('LOGOUT', `Usuario ${user.email} cerró sesión`);
  }
  
  return { success: true };
}

// EN Code.gs - AGREGAR ESTA FUNCIÓN (al final del archivo)
function getAppUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (error) {
    // Fallback si no puede obtener la URL
    return ScriptApp.getService().getUrl();
  }
}