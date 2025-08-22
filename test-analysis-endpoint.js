// Script para probar el endpoint de análisis directamente
const fetch = require('node-fetch');

async function testAnalysisEndpoint() {
  console.log('🧪 PROBANDO ENDPOINT DE ANÁLISIS DE ACTIVIDAD\n');
  
  // Datos de prueba para una actividad
  const testData = {
    activityId: "1",
    activityType: "assign",
    activityData: {
      id: "1",
      name: "Tarea de prueba",
      type: "assign",
      intro: "Esta es una tarea de prueba",
      course: "229",
      status: "open",
      assignDetails: {
        submissionCount: 10,
        gradeCount: 5,
        avgGrade: 85,
        gradingProgress: 50
      }
    },
    includeDetailedInfo: true
  };

  try {
    console.log('📤 Enviando solicitud de análisis...\n');
    
    const response = await fetch('http://localhost:3004/api/analysis/activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Necesitamos cookies de sesión para autenticación
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN_HERE'
      },
      body: JSON.stringify(testData)
    });

    const data = await response.json();
    
    console.log('📥 RESPUESTA RECIBIDA:\n');
    console.log('Status:', response.status);
    console.log('\n📊 ESTRUCTURA DE DATOS:\n');
    
    if (data.analysis) {
      console.log('✅ analysis existe');
      console.log('  - summary:', data.analysis.summary ? '✅' : '❌');
      console.log('  - fullAnalysis:', data.analysis.fullAnalysis ? '✅' : '❌');
      console.log('  - metricsTable:', data.analysis.metricsTable ? '✅' : '❌');
      console.log('  - structuredInsights:', data.analysis.structuredInsights ? '✅' : '❌');
      
      if (data.analysis.metricsTable) {
        console.log('\n📊 CONTENIDO DE metricsTable:');
        console.log(data.analysis.metricsTable);
      }
      
      if (data.analysis.structuredInsights) {
        console.log('\n📝 CONTENIDO DE structuredInsights:');
        console.log(JSON.stringify(data.analysis.structuredInsights, null, 2));
      }
      
      console.log('\n📄 ANÁLISIS COMPLETO:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ No se recibió análisis');
      console.log('Respuesta completa:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  testAnalysisEndpoint();
}

module.exports = { testAnalysisEndpoint };