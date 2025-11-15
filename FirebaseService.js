// FirebaseService.gs - Versión corregida
const FirebaseService = {
  _requestCount: 0,
  _lastRequestTime: 0,
  
  _getUserIdentifier: function() {
    try {
      const userEmail = Session.getEffectiveUser().getEmail();
      return Utilities.base64Encode(userEmail).replace(/=/g, '');
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      return 'unknown_user';
    }
  },
  
  _rateLimit: function() {
    const now = Date.now();
    const config = getConfig();
    
    // Reset counter si pasó más de 1 minuto
    if (now - this._lastRequestTime > 60000) {
      this._requestCount = 0;
      this._lastRequestTime = now;
    }
    
    // Limitar a 10 requests por minuto por usuario
    if (this._requestCount >= 10) {
      Utilities.sleep(1000);
      this._requestCount = 0;
    }
    
    this._requestCount++;
  },
  
  _getAccessToken: function() {
    try {
      // Usando el método de autenticación que ya tienes funcionando
      const config = getConfig();
      const serviceAccount = JSON.parse(config.firebase.secret);
      
      const header = {
        "alg": "HS256",
        "typ": "JWT"
      };
      
      const payload = {
        "iss": serviceAccount.client_email,
        "scope": "https://www.googleapis.com/auth/datastore",
        "aud": "https://oauth2.googleapis.com/token",
        "exp": Math.floor(Date.now() / 1000) + 3600,
        "iat": Math.floor(Date.now() / 1000)
      };
      
      const encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(header));
      const encodedPayload = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
      const signatureInput = encodedHeader + "." + encodedPayload;
      const signature = Utilities.computeHmacSha256Signature(signatureInput, serviceAccount.private_key);
      const encodedSignature = Utilities.base64EncodeWebSafe(signature);
      
      const jwt = signatureInput + "." + encodedSignature;
      
      const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
        method: 'post',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        payload: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        }
      });
      
      const tokenData = JSON.parse(tokenResponse.getContentText());
      return tokenData.access_token;
    } catch (error) {
      console.error('Error obteniendo token:', error);
      throw error;
    }
  },
  
  _request: function(path, method = 'GET', data = null, retryCount = 0) {
    this._rateLimit();
    
    const config = getConfig();
    const url = `${config.firebase.endpoint}/${path}`;
    
    const options = {
      method: method,
      headers: {
        'Authorization': `Bearer ${this._getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      muteHttpExceptions: true
    };
    
    if (data && (method === 'POST' || method === 'PATCH')) {
      options.payload = JSON.stringify(data);
    }
    
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const content = response.getContentText();
      
      if (responseCode !== 200) {
        const errorMsg = `Firestore error ${responseCode}: ${content}`;
        
        // Reintentar en caso de error del servidor
        if (responseCode >= 500 && retryCount < config.app.maxRetries) {
          Utilities.sleep(config.app.delayBetweenRetries);
          return this._request(path, method, data, retryCount + 1);
        }
        
        throw new Error(errorMsg);
      }
      
      return content ? JSON.parse(content) : { success: true };
      
    } catch (error) {
      console.error('Firestore request failed:', error);
      
      if (retryCount < config.app.maxRetries) {
        Utilities.sleep(config.app.delayBetweenRetries);
        return this._request(path, method, data, retryCount + 1);
      }
      
      throw error;
    }
  },
  
  // Método para evitar mezcla de datos entre usuarios
  getUserPath: function(collection, documentId = null) {
    const userId = this._getUserIdentifier();
    const basePath = `${collection}/${userId}`;
    
    return documentId ? `${basePath}/${documentId}` : basePath;
  },
  
  // CRUD Operations
  createDocument: function(collection, data) {
    try {
      // Validación básica
      if (!data || typeof data !== 'object') {
        throw new Error('Datos inválidos para crear documento');
      }
      
      const path = this.getUserPath(collection);
      const result = this._request(path, 'POST', {
        fields: this._convertToFirestoreFields(data)
      });
      
      // Log simple
      console.log('Documento creado en', collection, 'por usuario:', this._getUserIdentifier());
      
      return { success: true, result: result };
      
    } catch (error) {
      console.error('Error creando documento:', error);
      return { success: false, error: error.message };
    }
  },
  
  getDocument: function(collection, documentId = null) {
    try {
      const path = this.getUserPath(collection, documentId);
      const result = this._request(path);
      
      return { success: true, data: result };
      
    } catch (error) {
      console.error('Error obteniendo documento:', error);
      return { success: false, error: error.message };
    }
  },
  
  updateDocument: function(collection, documentId, data) {
    try {
      if (!data || typeof data !== 'object') {
        throw new Error('Datos inválidos para actualizar documento');
      }
      
      const path = this.getUserPath(collection, documentId);
      const result = this._request(path, 'PATCH', {
        fields: this._convertToFirestoreFields(data)
      });
      
      console.log('Documento actualizado en', collection, 'ID:', documentId);
      
      return { success: true, result: result };
      
    } catch (error) {
      console.error('Error actualizando documento:', error);
      return { success: false, error: error.message };
    }
  },
  
  deleteDocument: function(collection, documentId) {
    try {
      const path = this.getUserPath(collection, documentId);
      const result = this._request(path, 'DELETE');
      
      console.log('Documento eliminado de', collection, 'ID:', documentId);
      
      return { success: true, result: result };
      
    } catch (error) {
      console.error('Error eliminando documento:', error);
      return { success: false, error: error.message };
    }
  },
  
  // Conversión de datos para Firestore (simplificada)
  _convertToFirestoreFields: function(data) {
    const fields = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        continue; // Saltar valores nulos
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (typeof value === 'number') {
        fields[key] = { doubleValue: value };
      } else if (typeof value === 'string') {
        fields[key] = { stringValue: value };
      } else {
        // Por defecto, tratar como string
        fields[key] = { stringValue: String(value) };
      }
    }
    
    return fields;
  },
  
  // Verificar conexión simple
  testConnection: function() {
    try {
      const result = this.getDocument('test');
      return { connected: true, data: result };
    } catch (error) {
      return { connected: false, error: error.message };
    }
  }
};