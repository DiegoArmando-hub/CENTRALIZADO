// AuthService.gs - Versión corregida y funcional
function validateUser(email, password) {
  try {
    if (!email || !password) {
      return { success: false, error: 'Email y contraseña son requeridos' };
    }
    
    const config = getConfig();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(config.sheets.usuarios);
    
    if (!sheet) {
      return { success: false, error: 'Error del sistema: No se encontró la hoja de usuarios' };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const emailIndex = headers.indexOf('correo');
    const passwordIndex = headers.indexOf('contraseña');
    const nameIndex = headers.indexOf('Nombre');
    const aliasIndex = headers.indexOf('alias');
    
    // Si no encuentra las columnas, usar índices por defecto
    const useEmailIndex = emailIndex !== -1 ? emailIndex : 1;
    const usePasswordIndex = passwordIndex !== -1 ? passwordIndex : 2;
    const useNameIndex = nameIndex !== -1 ? nameIndex : 0;
    const useAliasIndex = aliasIndex !== -1 ? aliasIndex : 3;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[useEmailIndex] === email && row[usePasswordIndex] === password) {
        const userData = {
          email: email,
          name: row[useNameIndex] || 'Usuario',
          alias: row[useAliasIndex] || email.split('@')[0],
          loginTime: new Date().toISOString(),
          sessionId: Utilities.getUuid()
        };
        
        // Guardar sesión
        const sessionResult = setUserSession(userData);
        if (sessionResult.success) {
          console.log('Login exitoso para:', email);
          return { success: true, user: userData };
        } else {
          return { success: false, error: 'Error creando sesión' };
        }
      }
    }
    
    return { success: false, error: 'Credenciales inválidas' };
    
  } catch (error) {
    console.error('Error en validateUser:', error);
    return { success: false, error: 'Error del sistema durante la autenticación' };
  }
}

function setUserSession(userData) {
  try {
    const cache = CacheService.getScriptCache();
    const userCache = CacheService.getUserCache();
    
    const sessionData = {
      email: userData.email,
      name: userData.name,
      alias: userData.alias,
      sessionId: userData.sessionId,
      lastActivity: new Date().getTime(),
      loginTime: userData.loginTime
    };
    
    // Guardar en cache
    cache.put(userData.sessionId, JSON.stringify(sessionData), 1800); // 30 minutos
    userCache.put('current_session', userData.sessionId, 3600);
    
    return { success: true };
  } catch (error) {
    console.error('Error en setUserSession:', error);
    return { success: false, error: error.message };
  }
}

function getCurrentUser() {
  try {
    const userCache = CacheService.getUserCache();
    const sessionId = userCache.get('current_session');
    
    if (!sessionId) {
      return null;
    }
    
    const cache = CacheService.getScriptCache();
    const sessionData = cache.get(sessionId);
    
    if (sessionData) {
      const data = JSON.parse(sessionData);
      
      // Verificar timeout de sesión (30 minutos)
      const now = new Date().getTime();
      if (now - data.lastActivity > 30 * 60 * 1000) {
        // Sesión expirada
        cache.remove(sessionId);
        userCache.remove('current_session');
        return null;
      }
      
      // Actualizar última actividad
      data.lastActivity = now;
      cache.put(sessionId, JSON.stringify(data), 1800);
      
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('Error en getCurrentUser:', error);
    return null;
  }
}

function logoutUser() {
  try {
    const user = getCurrentUser();
    if (user) {
      const cache = CacheService.getScriptCache();
      const userCache = CacheService.getUserCache();
      
      cache.remove(user.sessionId);
      userCache.remove('current_session');
      
      console.log('Logout exitoso para:', user.email);
    }
    return { success: true, message: 'Sesión cerrada correctamente' };
  } catch (error) {
    console.error('Error en logoutUser:', error);
    return { success: false, error: error.message };
  }
}

function isUserAuthenticated() {
  return getCurrentUser() !== null;
}