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

// ✅ FUNCIÓN COMPATIBILIDAD - Usa AuthService
function login(usuarioInput, password) {
  return validateUser(usuarioInput, password);
}

// ✅ NUEVA FUNCIÓN CON IP - Usa AuthService
function loginWithIP(usuarioInput, password, clientIP) {
  const result = validateUser(usuarioInput, password);
  if (result.success) {
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

// ✅ FUNCIÓN MÓDULOS
function openModule(moduleName) {
  const user = getCurrentUser();
  logAction('MODULE_ACCESS', `Accedió al módulo: ${moduleName}`);
  
  return getModuleResponse(moduleName);
}

// ✅ NUEVA FUNCIÓN CON IP
function openModuleWithIP(moduleName, clientIP) {
  const user = getCurrentUser();
  logAction('MODULE_ACCESS', `Accedió al módulo: ${moduleName}`, clientIP);
  
  return getModuleResponse(moduleName);
}

// ✅ FUNCIÓN PRIVADA PARA RESPUESTAS DE MÓDULOS
function getModuleResponse(moduleName) {
  switch(moduleName) {
    case 'CONTROL_ASISTENCIA':
      return { 
        success: true, 
        message: 'Módulo Control Asistencia abierto',
        module: 'CONTROL_ASISTENCIA'
      };
    case 'GESTION_ALUMNOS':
      return { 
        success: true, 
        message: 'Módulo Gestión Alumnos abierto',
        module: 'GESTION_ALUMNOS'
      };
    case 'SEGUIMIENTO_CURSOS':
      return { 
        success: true, 
        message: 'Módulo Seguimiento Cursos abierto',
        module: 'SEGUIMIENTO_CURSOS'
      };
    case 'GESTION_CURSOS':
      return { 
        success: true, 
        message: 'Módulo Gestión Cursos abierto',
        module: 'GESTION_CURSOS'
      };
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

// ✅ OBTENER URL DE LA APP
function getAppUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (error) {
    return 'https://script.google.com/macros/s/' + ScriptApp.getScriptId() + '/exec';
  }
}