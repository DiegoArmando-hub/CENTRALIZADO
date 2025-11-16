var FirebaseService = {
  getInstance: function() {
    const config = getConfig();
    
    return {
      _getAccessToken: function() {
        try {
          const serviceAccountJson = PropertiesService.getScriptProperties().getProperty('FIREBASE_SECRET');
          if (!serviceAccountJson) {
            throw new Error('FIREBASE_SECRET no configurado');
          }
          
          const serviceAccount = JSON.parse(serviceAccountJson);
          
          const header = { "alg": "RS256", "typ": "JWT" };
          const now = Math.floor(Date.now() / 1000);
          
          const payload = {
            "iss": serviceAccount.client_email,
            "scope": "https://www.googleapis.com/auth/datastore",
            "aud": "https://oauth2.googleapis.com/token",
            "exp": now + 3600,
            "iat": now
          };
          
          const encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(header));
          const encodedPayload = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
          const signatureInput = encodedHeader + "." + encodedPayload;
          
          const signature = Utilities.computeRsaSha256Signature(signatureInput, serviceAccount.private_key);
          const encodedSignature = Utilities.base64EncodeWebSafe(signature);
          
          const jwt = encodedHeader + "." + encodedPayload + "." + encodedSignature;
          
          const tokenResponse = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
            method: 'post',
            payload: {
              grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
              assertion: jwt
            }
          });
          
          const tokenData = JSON.parse(tokenResponse.getContentText());
          return tokenData.access_token;
          
        } catch (error) {
          console.error('Firebase Auth Error:', error);
          throw error;
        }
      },
      
      // 🎯 MODIFICACIÓN PRINCIPAL - ALIAS EN TEXTO CLARO
      _getUserHash: function() {
        const user = getCurrentUser();
        // Si hay usuario logueado, usar su ALIAS en texto claro
        if (user && user.alias) {
          return user.alias; // ← ALIAS EN TEXTO CLARO
        }
        // Fallback: usar email de Google
        const userEmail = Session.getEffectiveUser().getEmail();
        return userEmail.split('@')[0]; // ← Solo la parte antes del @
      },
      
      _getUserCollection: function(collection) {
        const userHash = this._getUserHash();
        return `users/${userHash}/${collection}`;
      },
      
      _request: function(path, method, data) {
        try {
          const accessToken = this._getAccessToken();
          const url = `${config.firebase.endpoint}/${path}`;
          
          const options = {
            method: method,
            contentType: 'application/json',
            muteHttpExceptions: true,
            headers: {
              'Authorization': `Bearer ${accessToken}`
            }
          };
          
          if (data && ['POST', 'PATCH'].includes(method)) {
            options.payload = JSON.stringify(data);
          }
          
          const response = UrlFetchApp.fetch(url, options);
          const content = response.getContentText();
          
          if (response.getResponseCode() >= 400) {
            throw new Error(`Firestore error ${response.getResponseCode()}: ${content}`);
          }
          
          return content ? JSON.parse(content) : { success: true };
          
        } catch (error) {
          console.error('Firestore Request Error:', error);
          throw error;
        }
      },
      
      // CREATE - Crear documento
      create: function(collection, data) {
        const userCollection = this._getUserCollection(collection);
        const timestamp = new Date().toISOString();
        
        const document = {
          fields: this._convertToFirestoreFields({
            ...data,
            _metadata: {
              createdBy: this._getUserHash(), // ← Ahora usa el alias
              createdAt: timestamp,
              updatedBy: this._getUserHash(), // ← Ahora usa el alias
              updatedAt: timestamp
            }
          })
        };
        
        return this._request(userCollection, 'POST', document);
      },
      
      // READ - Obtener documento
      get: function(collection, documentId) {
        const userCollection = this._getUserCollection(collection);
        const result = this._request(`${userCollection}/${documentId}`, 'GET');
        return this._convertFromFirestore(result);
      },
      
      // LIST - Listar documentos
      list: function(collection, limit = 100) {
        const userCollection = this._getUserCollection(collection);
        
        const query = {
          structuredQuery: {
            from: [{ collectionId: collection.split('/').pop() }],
            limit: limit
          }
        };
        
        const result = this._request(`${userCollection}:runQuery`, 'POST', query);
        return Array.isArray(result) ? result.map(doc => this._convertFromFirestore(doc.document)) : [];
      },
      
      // UPDATE - Actualizar documento
      update: function(collection, documentId, data) {
        const userCollection = this._getUserCollection(collection);
        const timestamp = new Date().toISOString();
        
        const updateData = {
          ...data,
          _metadata: {
            updatedBy: this._getUserHash(), // ← Ahora usa el alias
            updatedAt: timestamp
          }
        };
        
        const document = {
          fields: this._convertToFirestoreFields(updateData)
        };
        
        const updateFields = Object.keys(data).map(field => `fields.${field}`);
        updateFields.push('fields._metadata.updatedBy', 'fields._metadata.updatedAt');
        
        return this._request(
          `${userCollection}/${documentId}?updateMask.fieldPaths=${updateFields.join('&updateMask.fieldPaths=')}`, 
          'PATCH', 
          document
        );
      },
      
      // DELETE - Eliminar documento
      delete: function(collection, documentId) {
        const userCollection = this._getUserCollection(collection);
        return this._request(`${userCollection}/${documentId}`, 'DELETE');
      },
      
      // Conversión de datos
      _convertToFirestoreFields: function(data) {
        const fields = {};
        for (const [key, value] of Object.entries(data)) {
          fields[key] = this._convertToFirestoreValue(value);
        }
        return fields;
      },
      
      _convertToFirestoreValue: function(value) {
        if (typeof value === 'string') {
          return { stringValue: value };
        } else if (typeof value === 'number') {
          return { integerValue: value };
        } else if (typeof value === 'boolean') {
          return { booleanValue: value };
        } else if (value instanceof Date) {
          return { timestampValue: value.toISOString() };
        } else if (Array.isArray(value)) {
          return {
            arrayValue: {
              values: value.map(item => this._convertToFirestoreValue(item))
            }
          };
        } else if (typeof value === 'object' && value !== null) {
          return {
            mapValue: {
              fields: this._convertToFirestoreFields(value)
            }
          };
        }
        return { nullValue: null };
      },
      
      _convertFromFirestore: function(firestoreDoc) {
        if (!firestoreDoc || !firestoreDoc.fields) return null;
        
        const result = {};
        for (const [key, value] of Object.entries(firestoreDoc.fields)) {
          result[key] = this._extractFirestoreValue(value);
        }
        
        if (firestoreDoc.name) {
          result.id = firestoreDoc.name.split('/').pop();
        }
        
        return result;
      },
      
      _extractFirestoreValue: function(valueObj) {
        const type = Object.keys(valueObj)[0];
        const value = valueObj[type];
        
        switch (type) {
          case 'stringValue': return value;
          case 'integerValue': return parseInt(value);
          case 'doubleValue': return parseFloat(value);
          case 'booleanValue': return value === true || value === 'true';
          case 'timestampValue': return new Date(value);
          case 'arrayValue': 
            return value.values ? value.values.map(item => this._extractFirestoreValue(item)) : [];
          case 'mapValue':
            return value.fields ? this._convertFromFirestore({ fields: value.fields }) : {};
          default: return value;
        }
      }
    };
  }
};