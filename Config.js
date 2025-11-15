function getConfig() {
  const props = PropertiesService.getScriptProperties();
  const projectId = props.getProperty('FIREBASE_PROJECT_ID');
  
  return {
    firebase: {
      projectId: projectId,
      collectionName: props.getProperty('FIRESTORE_COLLECTION') || 'db_cursos',
      endpoint: `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`,
      secret: props.getProperty('FIREBASE_SECRET')
    },
    sheets: {
      usuarios: props.getProperty('SHEET_USUARIOS_ID'),
      logs: props.getProperty('SHEET_LOGS_ID'),
      parametros: props.getProperty('SHEET_PARAMETROS_ID')
    },
    app: {
      name: props.getProperty('APP_NAME') || 'Sistema Gestión Educativa',
      version: props.getProperty('APP_VERSION') || '1.0.0',
      timeout: parseInt(props.getProperty('SESSION_TIMEOUT')) || 30,
      maxRetries: 3,
      delayBetweenRetries: 1000,
      maxBatchSize: 10
    }
  };
}

