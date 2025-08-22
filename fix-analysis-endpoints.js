const fs = require('fs');
const path = require('path');

const filePath = '/Users/paulocesarsanchezespindola/Documents/UTEL/Profebot/app-dashboard/app/api/analysis/activity/route.ts';

console.log('🔧 Actualizando endpoints de análisis para formato JSON estructurado...');

// Leer el archivo
let content = fs.readFileSync(filePath, 'utf8');

// 1. Actualizar todos los prompts de asignaciones para incluir formato JSON
content = content.replace(
  /(\*\*ESTRUCTURA REQUERIDA\*\*:[\s\S]*?)(\*\*IMPORTANTE\*\*:[\s\S]*?)`(\s+} else if)/g,
  `**INSTRUCCIONES ESPECIALES PARA PRESENTACIÓN VISUAL:**
- Si tienes datos cuantitativos importantes (métricas, porcentajes, conteos), incluye una tabla en "metricsTable" usando formato "Indicador | Valor"
- Para análisis complejos que requieren numeración específica, usa "structuredInsights.numbered"
- Para puntos clave sin orden específico, usa "structuredInsights.bullets"
- Incluir tanto formatos estructurados como tradicionales para compatibilidad

**RESPONDE ÚNICAMENTE EN FORMATO JSON:**
{
  "summary": "Resumen ejecutivo del análisis (2-3 líneas)",
  "fullAnalysis": "Análisis completo en markdown con secciones ## dinámicas",
  "positives": ["aspecto positivo 1", "aspecto positivo 2"],
  "alerts": ["alerta importante 1", "alerta importante 2"],
  "insights": ["insight clave 1", "insight clave 2"],
  "recommendation": "Recomendación principal específica",
  "metricsTable": "Indicador | Valor observado\\nEntregas recibidas | \${analysisData.stats.submissionCount}\\nCalificaciones | \${analysisData.stats.gradeCount}\\nPromedio actual | \${analysisData.stats.avgGrade}\\nProgreso | \${analysisData.stats.gradingProgress}%",
  "structuredInsights": {
    "numbered": ["1. Insight prioritario sobre entregas", "2. Observación sobre calificaciones"],
    "bullets": ["• Fortaleza identificada", "• Área de mejora", "• Recomendación específica"]
  }
}
\`$3`
);

// 2. Actualizar messages del sistema para OpenAI en todas las funciones
content = content.replace(
  /role: "system",[\s]*content: "Eres un experto en análisis educativo\. Proporciona insights profesionales usando formato Markdown para mejorar la presentación visual\.[\s\S]*?Adapta dinámicamente el formato según el contenido - no uses estructura rígida\. Tu análisis debe ser conversacional, profesional y visualmente organizado\."/g,
  'role: "system",\n          content: "Eres un experto en análisis educativo. Debes responder ÚNICAMENTE en formato JSON válido con la estructura exacta solicitada. Incluye datos cuantitativos en metricsTable cuando sea relevante, y separa insights en numerados (para orden específico) y bullets (para puntos generales). El fullAnalysis debe usar markdown con secciones ##."'
);

// 3. Reemplazar procesamiento de parseFlexibleAnalysis por JSON parsing en todas las funciones
content = content.replace(
  /const analysisText = completion\.choices\[0\]\?\.message\?\.content \|\| ''[\s]*\/\/ Procesar la respuesta de forma flexible[\s]*const analysis = parseFlexibleAnalysis\(analysisText\)/g,
  `const analysisText = completion.choices[0]?.message?.content || ''
    
    // Procesar la respuesta JSON
    let analysis
    try {
      analysis = JSON.parse(analysisText)
    } catch (parseError) {
      console.error('❌ Error parseando JSON de OpenAI, usando fallback:', parseError)
      // Fallback a análisis básico si falla el parsing
      analysis = {
        summary: 'Análisis generado con formato de respaldo',
        fullAnalysis: analysisText,
        positives: ['Contenido disponible para revisión'],
        alerts: ['Formato de respuesta no estructurado'],
        insights: ['Requiere revisión manual'],
        recommendation: 'Revisar configuración del análisis'
      }
    }`
);

// 4. Actualizar prompt de quiz/actividades genéricas también
content = content.replace(
  /(Crea entre 5-7 secciones usando títulos descriptivos[\s\S]*?Adapta el análisis al tipo específico de actividad educativa)(\s*`)/g,
  `**INSTRUCCIONES ESPECIALES PARA PRESENTACIÓN VISUAL:**
- Si tienes datos cuantitativos importantes (métricas, porcentajes, conteos), incluye una tabla en "metricsTable" usando formato "Indicador | Valor"
- Para análisis complejos que requieren numeración específica, usa "structuredInsights.numbered"
- Para puntos clave sin orden específico, usa "structuredInsights.bullets"
- Incluir tanto formatos estructurados como tradicionales para compatibilidad

**RESPONDE ÚNICAMENTE EN FORMATO JSON:**
{
  "summary": "Resumen ejecutivo del análisis (2-3 líneas)",
  "fullAnalysis": "Análisis completo en markdown con secciones ## dinámicas",
  "positives": ["aspecto positivo 1", "aspecto positivo 2"],
  "alerts": ["alerta importante 1", "alerta importante 2"],
  "insights": ["insight clave 1", "insight clave 2"],
  "recommendation": "Recomendación principal específica",
  "metricsTable": "Indicador | Valor observado\\nTipo de actividad | \${activityData.name || 'Actividad educativa'}\\nEstado | \${activityData.status || 'Activa'}\\nConfiguración | \${Object.keys(activityData).length} parámetros",
  "structuredInsights": {
    "numbered": ["1. Insight prioritario sobre la actividad", "2. Observación sobre configuración"],
    "bullets": ["• Aspecto destacado", "• Área de atención", "• Recomendación específica"]
  }
}$2`
);

// Escribir el archivo actualizado
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Archivo actualizado exitosamente');
console.log('📋 Cambios realizados:');
console.log('  - Prompts actualizados para formato JSON');
console.log('  - Sistema de mensajes de OpenAI actualizado');
console.log('  - Procesamiento de respuestas cambiado a JSON parsing');
console.log('  - Formato estructurado agregado a todas las funciones de análisis');