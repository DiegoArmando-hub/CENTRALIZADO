function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function validateUserData(userData) {
  const errors = [];
  
  if (!userData.nombre || userData.nombre.trim().length < 2) {
    errors.push('Nombre debe tener al menos 2 caracteres');
  }
  
  if (!validateEmail(userData.correo)) {
    errors.push('Correo electrónico no válido');
  }
  
  if (!userData.contraseña || userData.contraseña.length < 6) {
    errors.push('Contraseña debe tener al menos 6 caracteres');
  }
  
  if (!userData.alias || userData.alias.trim().length < 2) {
    errors.push('Alias debe tener al menos 2 caracteres');
  }
  
  return errors;
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim()
    .substring(0, 1000);
}

function validateFirestoreData(collection, data) {
  const errors = [];
  
  switch(collection) {
    case 'alumnos':
      if (!data.nombre || data.nombre.trim().length < 2) {
        errors.push('Nombre de alumno inválido');
      }
      if (!data.curso || data.curso.trim().length === 0) {
        errors.push('Curso es requerido');
      }
      break;
      
    case 'asistencia':
      if (!data.alumnoId || data.alumnoId.trim().length === 0) {
        errors.push('ID de alumno requerido');
      }
      if (!data.fecha) {
        errors.push('Fecha requerida');
      }
      break;
      
    case 'cursos':
      if (!data.nombre || data.nombre.trim().length < 2) {
        errors.push('Nombre de curso inválido');
      }
      break;
  }
  
  return errors;
}

function validateBatchOperations(operations, maxBatchSize) {
  if (!operations || !Array.isArray(operations)) {
    return { valid: false, error: 'Operations debe ser un array' };
  }
  
  if (operations.length > maxBatchSize) {
    return { 
      valid: false, 
      error: 'Límite excedido. Máximo ' + maxBatchSize + ' operaciones por lote' 
    };
  }
  
  return { valid: true };
}