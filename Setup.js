function testSystem() {
  try {
    const config = getConfig();
    const user = getCurrentUser();
    
    // Verificar Firebase
    let firebaseStatus = 'NO CONFIGURADO';
    if (config.firebase.projectId) {
      try {
        const firestore = FirebaseService.getInstance();
        // Test simple de conexión
        firebaseStatus = 'CONFIGURADO';
      } catch (e) {
        firebaseStatus = 'ERROR: ' + e.message;
      }
    }
    
    // Verificar Sheets
    const sheetsStatus = {
      usuarios: testSheetAccess(config.sheets.usuarios),
      logs: testSheetAccess(config.sheets.logs),
      parametros: testSheetAccess(config.sheets.parametros)
    };
    
    // Verificar Auth
    const authStatus = user ? 'AUTENTICADO' : 'NO AUTENTICADO';
    
    const result = {
      success: true,
      timestamp: new Date().toISOString(),
      config: {
        firebase: firebaseStatus,
        sheets: sheetsStatus,
        app: config.app
      },
      user: user,
      auth: authStatus
    };
    
    console.log('✅ TEST SYSTEM RESULT:', JSON.stringify(result, null, 2));
    return result;
    
  } catch (error) {
    const errorResult = {
      success: false,
      error: error.toString(),
      timestamp: new Date().toISOString()
    };
    
    console.log('❌ TEST SYSTEM ERROR:', errorResult);
    return errorResult;
  }
}

function testSheetAccess(sheetId) {
  if (!sheetId) return 'NO CONFIGURADO';
  
  try {
    const sheet = SpreadsheetApp.openById(sheetId);
    const name = sheet.getName();
    return 'ACCESIBLE - ' + name;
  } catch (error) {
    return 'ERROR: ' + error.message;
  }
}

function testFirebaseConnection() {
  try {
    const firestore = FirebaseService.getInstance();
    
    // Crear documento de prueba
    const testData = {
      test: true,
      message: 'Prueba de conexión desde Apps Script',
      timestamp: new Date().toISOString(),
      user: Session.getEffectiveUser().getEmail()
    };
    
    const result = firestore.create('connection_test', testData);
    console.log('✅ Firebase Test - Documento creado:', result.name);
    
    // Leer el documento
    if (result.name) {
      const docId = result.name.split('/').pop();
      const readResult = firestore.get('connection_test', docId);
      console.log('✅ Firebase Test - Documento leído:', readResult);
      
      // Eliminar el documento
      firestore.delete('connection_test', docId);
      console.log('✅ Firebase Test - Documento eliminado');
    }
    
    return {
      success: true,
      message: 'Conexión a Firebase exitosa'
    };
    
  } catch (error) {
    console.log('❌ Firebase Test Error:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

function createTestSheets() {
  // Crear sheets de prueba si no existen
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet Usuarios
  let sheet = ss.getSheetByName('USUARIOS_PRUEBA');
  if (!sheet) {
    sheet = ss.insertSheet('USUARIOS_PRUEBA');
    sheet.getRange(1, 1, 1, 4).setValues([[
      'Nombre', 'correo', 'alias', 'contraseña'
    ]]);
    sheet.getRange(2, 1, 3, 4).setValues([
      ['Admin Test', 'admin@test.com', 'admin', 'admin123'],
      ['Usuario Test', 'usuario@test.com', 'usuario', 'user123'],
      ['Teacher Test', 'teacher@test.com', 'teacher', 'teach123']
    ]);
  }
  
  // Sheet Logs
  sheet = ss.getSheetByName('LOGS_PRUEBA');
  if (!sheet) {
    sheet = ss.insertSheet('LOGS_PRUEBA');
    sheet.getRange(1, 1, 1, 5).setValues([[
      'Timestamp', 'Usuario', 'Acción', 'Detalles', 'IP'
    ]]);
  }
  
  // Sheet Parámetros
  sheet = ss.getSheetByName('PARAMETROS_PRUEBA');
  if (!sheet) {
    sheet = ss.insertSheet('PARAMETROS_PRUEBA');
    sheet.getRange(1, 1, 1, 3).setValues([[
      'Parametro', 'Valor', 'Descripción'
    ]]);
    sheet.getRange(2, 1, 4, 3).setValues([
      ['INSTITUCION_NOMBRE', 'Escuela Prueba', 'Nombre de prueba'],
      ['PAIS', 'España', 'País de prueba'],
      ['CIUDAD', 'Madrid', 'Ciudad de prueba'],
      ['TIMEZONE', 'Europe/Madrid', 'Zona horaria']
    ]);
  }
  
  console.log('✅ Sheets de prueba creados');
  return {
    usuarios: ss.getSheetByName('USUARIOS_PRUEBA').getParent().getId(),
    logs: ss.getSheetByName('LOGS_PRUEBA').getParent().getId(),
    parametros: ss.getSheetByName('PARAMETROS_PRUEBA').getParent().getId()
  };
}