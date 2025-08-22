// Script para debuggear el proceso de análisis
// Ejecutar en la consola del navegador

console.log('🔍 DEBUGGING ANÁLISIS DE CURSO');

// 1. Verificar si hay un curso seleccionado
const courseSelector = document.querySelector('[data-testid="course-selector"]') || 
                      document.querySelector('select') ||
                      document.querySelector('[role="combobox"]');

if (courseSelector) {
  console.log('✅ Selector de curso encontrado:', courseSelector.value || courseSelector.textContent);
} else {
  console.log('❌ No se encontró selector de curso');
}

// 2. Interceptar llamadas fetch
const originalFetch = window.fetch;
window.fetch = function(...args) {
  console.log('🌐 FETCH interceptado:', args[0]);
  
  if (args[0].includes('/api/analysis/generate-course-analysis')) {
    console.log('🎯 Llamada a generate-course-analysis detectada');
    console.log('📤 Body:', args[1]?.body);
  }
  
  return originalFetch.apply(this, args)
    .then(response => {
      if (args[0].includes('/api/analysis/')) {
        console.log('📥 Respuesta de análisis:', response.status, response.statusText);
        
        // Clonar respuesta para poder leerla sin afectar el flujo original
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
          console.log('📊 Datos de respuesta:', data);
        }).catch(err => {
          console.log('⚠️ Error parseando respuesta como JSON:', err);
        });
      }
      return response;
    })
    .catch(error => {
      if (args[0].includes('/api/analysis/')) {
        console.log('❌ Error en fetch de análisis:', error);
      }
      throw error;
    });
};

// 3. Verificar estado actual del localStorage
console.log('💾 Estado del localStorage:');
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  if (key.includes('analysis') || key.includes('course')) {
    console.log(`  ${key}: ${localStorage.getItem(key)?.substring(0, 100)}...`);
  }
}

console.log('🎯 Para activar debugging, presiona el botón "Analizar Curso"');
console.log('📋 Para restaurar fetch original: window.fetch = originalFetch');