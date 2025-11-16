function doGet(e) {
  console.log('🔍 Verificando autenticación...');
  
  // ✅ VERIFICAR SI ES UNA SOLICITUD DE API
  if (e?.parameter?.action) {
    return handleApiRequest(e);
  }
  
  // ✅ LIMPIAR CACHE DEL NAVEGADOR CON PARÁMETROS
  if (e?.parameter?.auth || e?.parameter?.logout) {
    console.log('🧹 Limpiando cache con parámetros de URL:', e.parameter);
    // Forzar que no se cachee la respuesta
    const user = getCurrentUser();
    let html;
    
    if (!user) {
      console.log('❌ Usuario no autenticado después de parámetros, mostrando login');
      html = renderLoginPage();
    } else {
      console.log('✅ Usuario autenticado después de parámetros:', user.email);
      html = renderMainPage();
    }
    
    return html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
              .setTitle('Sistema Gestión Educativa')
              .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  }
  
  // ✅ VERIFICAR SI HAY USUARIO AUTENTICADO
  const user = getCurrentUser();
  if (!user) {
    console.log('❌ Usuario no autenticado, mostrando login');
    return renderLoginPage();
  }
  
  console.log('✅ Usuario autenticado:', user.email, 'mostrando dashboard');
  return renderMainPage();
}

function doPost(e) {
  return doGet(e);
}

// ✅ MANEJAR SOLICITUDES DE API
function handleApiRequest(e) {
  const action = e.parameter.action;
  
  switch(action) {
    case 'validateToken':
      return validateToken(e);
    case 'logDirectAccess':
      return logDirectAccess(e);
    case 'checkAuth':
      return checkAuthStatus(e);
    default:
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'Acción no válida'
      })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ✅ VERIFICAR ESTADO DE AUTENTICACIÓN
function checkAuthStatus(e) {
  const user = getCurrentUser();
  return ContentService.createTextOutput(JSON.stringify({
    authenticated: !!user,
    user: user
  })).setMimeType(ContentService.MimeType.JSON);
}

function renderLoginPage() {
  console.log('📄 Renderizando página de login');
  const html = HtmlService.createTemplateFromFile('Login')
    .evaluate()
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setTitle('Login - Sistema Gestión Educativa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
  return html;
}

function renderMainPage() {
  console.log('📄 Renderizando dashboard principal');
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
  console.log('🔐 Procesando login para:', usuarioInput);
  const result = validateUser(usuarioInput, password);
  
  if (result.success) {
    console.log('✅ Login exitoso para:', usuarioInput);
    logAction('LOGIN_SUCCESS', `Usuario ${result.user.alias} autenticado`, null);
  } else {
    console.log('❌ Login fallido para:', usuarioInput);
    logAction('LOGIN_FAILED', `Intento fallido para: ${usuarioInput}`, null);
  }
  
  return result;
}

// ✅ FUNCIÓN ESPECIAL PARA LOGIN CON REDIRECCIÓN
function loginAndRedirect(usuarioInput, password) {
  console.log('🔐 Procesando login con redirección para:', usuarioInput);
  const result = validateUser(usuarioInput, password);
  
  if (result.success) {
    console.log('✅ Login exitoso, preparando redirección para:', usuarioInput);
    logAction('LOGIN_SUCCESS', `Usuario ${result.user.alias} autenticado`, null);
    return {
      success: true,
      redirectUrl: ScriptApp.getService().getUrl()
    };
  } else {
    console.log('❌ Login fallido para:', usuarioInput);
    logAction('LOGIN_FAILED', `Intento fallido para: ${usuarioInput}`, null);
    return result;
  }
}

function logout() {
  const user = getCurrentUser();
  console.log('🚪 Procesando logout para:', user?.email);
  const result = logoutUser();
  
  if (result.success) {
    console.log('✅ Logout exitoso');
  } else {
    console.log('❌ Error en logout:', result.error);
  }
  
  return {
    success: result.success,
    redirectUrl: ScriptApp.getService().getUrl()
  };
}

function getUserInfo() {
  const user = getCurrentUser();
  console.log('📋 Solicitando info usuario:', user?.email);
  return user;
}

// ✅ GENERAR TOKEN SEGURO PARA MÓDULOS
function generateModuleToken(moduleName) {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('Usuario no autenticado');
  }
  
  const tokenData = {
    module: moduleName,
    user: user.email,
    alias: user.alias,
    sessionId: user.sessionId,
    timestamp: new Date().getTime(),
    expires: new Date().getTime() + (15 * 60 * 1000) // 15 minutos
  };
  
  const token = Utilities.base64Encode(JSON.stringify(tokenData));
  const tokenHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const secureToken = Utilities.base64EncodeWebSafe(tokenHash) + '.' + token;
  
  // Guardar token en cache para validación
  const cache = CacheService.getScriptCache();
  cache.put(`token_${moduleName}_${user.sessionId}`, secureToken, 900); // 15 minutos
  
  logAction('TOKEN_GENERATED', `Token generado para módulo: ${moduleName}`, null);
  
  return secureToken;
}

// ✅ VALIDAR TOKEN DESDE MÓDULOS EXTERNOS
function validateModuleToken(token, moduleName) {
  try {
    console.log('🔐 Iniciando validación de token...');
    console.log('📨 Token recibido:', token ? 'PRESENTE' : 'VACÍO');
    console.log('🎯 Módulo:', moduleName);
    
    if (!token) {
      console.log('❌ Token vacío recibido');
      logAction('TOKEN_REJECTED', 'Token vacío', null);
      return { valid: false, reason: 'Token vacío' };
    }
    
    const parts = token.split('.');
    if (parts.length !== 2) {
      console.log('❌ Formato de token inválido');
      logAction('TOKEN_REJECTED', 'Formato de token inválido', null);
      return { valid: false, reason: 'Formato inválido' };
    }
    
    const providedHash = parts[0];
    const tokenDataStr = parts[1];
    
    // Verificar hash
    const computedHash = Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, tokenDataStr)
    );
    
    if (providedHash !== computedHash) {
      console.log('❌ Hash de token inválido');
      logAction('TOKEN_REJECTED', 'Hash de token inválido', null);
      return { valid: false, reason: 'Hash inválido' };
    }
    
    const tokenData = JSON.parse(Utilities.base64Decode(tokenDataStr));
    console.log('📊 Token decodificado:', tokenData);
    
    // Verificar expiración
    if (new Date().getTime() > tokenData.expires) {
      console.log('❌ Token expirado');
      logAction('TOKEN_REJECTED', 'Token expirado', null);
      return { valid: false, reason: 'Token expirado' };
    }
    
    // Verificar módulo
    if (tokenData.module !== moduleName) {
      console.log('❌ Token para módulo incorrecto');
      logAction('TOKEN_REJECTED', 'Token para módulo incorrecto', null);
      return { valid: false, reason: 'Módulo incorrecto' };
    }
    
    // Verificar en cache
    const cache = CacheService.getScriptCache();
    const cachedToken = cache.get(`token_${moduleName}_${tokenData.sessionId}`);
    
    if (cachedToken !== token) {
      console.log('❌ Token no encontrado en cache');
      logAction('TOKEN_REJECTED', 'Token no encontrado en cache', null);
      return { valid: false, reason: 'Token no válido' };
    }
    
    console.log('✅ Token válido para usuario:', tokenData.alias);
    logAction('TOKEN_VALIDATED', `Token validado para módulo: ${moduleName} - Usuario: ${tokenData.alias}`, null);
    
    return {
      valid: true,
      user: {
        email: tokenData.user,
        alias: tokenData.alias
      },
      sessionId: tokenData.sessionId
    };
    
  } catch (error) {
    console.log('💥 Error validando token:', error.toString());
    logAction('TOKEN_REJECTED', `Error validando token: ${error.message}`, null);
    return { valid: false, reason: 'Error en validación: ' + error.message };
  }
}

// ✅ FUNCIÓN PARA VALIDAR TOKEN VIA POST (para módulos)
function validateToken(e) {
  try {
    console.log('🔐 Validando token recibido...');
    const token = e?.parameter?.token;
    const module = e?.parameter?.module;
    
    console.log('📨 Parámetros recibidos - token:', token ? 'PRESENTE' : 'VACÍO', 'módulo:', module);
    
    if (!token || !module) {
      console.log('❌ Faltan parámetros requeridos');
      return ContentService.createTextOutput(JSON.stringify({
        valid: false,
        reason: 'Token y módulo requeridos'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const result = validateModuleToken(token, module);
    console.log('📊 Resultado validación:', JSON.stringify(result));
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    console.log('💥 Error en validateToken:', error.toString());
    return ContentService.createTextOutput(JSON.stringify({
      valid: false,
      reason: 'Error interno del servidor: ' + error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ✅ FUNCIÓN PARA REGISTRAR ACCESO DIRECTO
function logDirectAccess(e) {
  try {
    const module = e?.parameter?.module;
    const ip = e?.parameter?.ip;
    
    logAction('DIRECT_ACCESS_ATTEMPT', `Intento de acceso directo a: ${module}`, ip);
    
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Acceso registrado'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ✅ FUNCIÓN MÓDULOS CON TOKEN
function openModule(moduleName) {
  const user = getCurrentUser();
  console.log('🚀 Abriendo módulo:', moduleName, 'para usuario:', user?.email);
  logAction('MODULE_ACCESS', `Accedió al módulo: ${moduleName}`);
  
  return getModuleResponse(moduleName);
}

// ✅ NUEVA FUNCIÓN CON IP Y TOKEN
function openModuleWithIP(moduleName, clientIP) {
  const user = getCurrentUser();
  console.log('🚀 Abriendo módulo con IP:', moduleName, 'para usuario:', user?.email);
  
  try {
    const token = generateModuleToken(moduleName);
    const moduleUrl = getModuleUrl(moduleName);
    
    if (!moduleUrl) {
      throw new Error(`URL no configurada para módulo: ${moduleName}`);
    }
    
    const redirectUrl = `${moduleUrl}?token=${encodeURIComponent(token)}&module=${encodeURIComponent(moduleName)}`;
    
    logAction('MODULE_ACCESS', `Accedió al módulo: ${moduleName}`, clientIP);
    
    console.log('🔗 Redireccionando a módulo:', redirectUrl);
    
    return { 
      success: true, 
      message: 'Redirigiendo al módulo...',
      module: moduleName,
      redirectUrl: redirectUrl,
      token: token // Para depuración
    };
    
  } catch (error) {
    console.error('❌ Error abriendo módulo:', error);
    logAction('UNAUTHORIZED_ACCESS', `Error acceso módulo ${moduleName}: ${error.message}`, clientIP);
    return { success: false, message: error.message };
  }
}

// ✅ OBTENER URL DEL MÓDULO - CORREGIDO
function getModuleUrl(moduleName) {
  const moduleUrls = {
    'CONTROL_ASISTENCIA': 'https://script.google.com/macros/s/AKfycbxnbsFzBWZq-C0-CLjB31oea-GlJYaMD1eEdp6QcZSL1KJoGbJAxsPeIAuQgZXVhajx/exec',
    'GESTION_ALUMNOS': 'https://script.google.com/macros/s/AKfycbz5mXpkeY9asKshfhSWo_5oJ7QYHxhdKd7e1Ibx3CtjL2y2eZf5zw4KqQDCM_aneovvTA/exec',
    'SEGUIMIENTO_CURSOS': 'https://script.google.com/macros/s/AKfycbzZfm8C6sarPq7o6yHdXz6Mv_9jWW8BUBNGgApmG4G7zTTqKaoTSaGg2vC03yY_nPwypA/exec',
    'GESTION_CURSOS': 'https://script.google.com/macros/s/AKfycbzZfm8C6sarPq7o6yHdXz6Mv_9jWW8BUBNGgApmG4G7zTTqKaoTSaGg2vC03yY_nPwypA/exec'
  };
  
  const url = moduleUrls[moduleName];
  console.log('🔗 URL del módulo', moduleName + ':', url);
  return url;
}

// ✅ FUNCIÓN PRIVADA PARA RESPUESTAS DE MÓDULOS (backward compatibility)
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