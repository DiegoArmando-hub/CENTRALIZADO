function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FIREBASE_PROJECT_ID');
  
  return {
    firebase: {
      projectId: projectId,
      collectionName: props.getProperty('FIRESTORE_COLLECTION') || 'db_cursos',
      endpoint: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`
      // NOTA: FIREBASE_SECRET se maneja directamente en FirebaseService
    },
    sheets: {
      usuarios: props.getProperty('SHEET_USUARIOS_ID'),
      logs: props.getProperty('SHEET_LOGS_ID'),
      parametros: props.getProperty('SHEET_PARAMETROS_ID')
    },
    app: {
      name: 'Sistema Gestión Educativa Centralizado',
      version: '2.0.0',
      timeout: 30,
      maxRetries: 3,
      delayBetweenRetries: 1000,
      maxBatchSize: 10
    }
  };
}