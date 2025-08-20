/**
 * Script para probar el análisis real con OpenAI
 */

import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

async function testRealAnalysis() {
  console.log('🔍 Probando análisis real con OpenAI...')
  
  // Verificar configuración
  const apiKey = process.env.OPENAI_API_KEY
  const hasValidApiKey = apiKey && 
    apiKey !== 'your-openai-api-key' && 
    apiKey.startsWith('sk-')
  
  if (!hasValidApiKey) {
    console.log('❌ API key no válida')
    return
  }
  
  console.log('✅ API key válida configurada')
  
  try {
    // Crear cliente OpenAI
    const openai = new OpenAI({
      apiKey: apiKey,
    })
    
    console.log('🧠 Probando conexión con OpenAI...')
    
    // Hacer una prueba simple
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "Eres un asistente educativo que analiza actividades de foros."
        },
        {
          role: "user",
          content: `Analiza esta actividad de foro educativo:

FORO: "Espacio Testing"
PARTICIPANTES: 3 (1 profesor, 2 estudiantes)
POSTS: 3 total

DISCUSIÓN:
- Post inicial del profesor: "Pruebas de funcionamiento de análisis inteligente"
- Respuesta estudiante 1: "Test de comentario sobre espacio testing"
- Retroalimentación profesor: Comentario detallado con sugerencias

Proporciona un análisis breve en formato JSON con:
- summary: resumen del estado
- positives: aspectos positivos
- alerts: alertas o problemas
- insights: observaciones clave
- recommendation: recomendación principal`
        }
      ],
      max_tokens: 500,
      temperature: 0.7
    })
    
    const result = response.choices[0]?.message?.content
    
    if (result) {
      console.log('✅ Conexión con OpenAI exitosa')
      console.log('🎯 Respuesta de prueba:')
      console.log(result.substring(0, 200) + '...')
      
      try {
        const parsed = JSON.parse(result)
        console.log('✅ Respuesta en formato JSON válido')
        console.log(`📊 Resumen: ${parsed.summary?.substring(0, 50)}...`)
      } catch (parseError) {
        console.log('⚠️ Respuesta no es JSON válido, pero OpenAI responde')
      }
      
      console.log('\n🎉 ÉXITO: El análisis real con OpenAI debe funcionar ahora')
      console.log('🎯 Puedes probar "Analizar visibles" en la interfaz')
      
    } else {
      console.log('❌ No se recibió respuesta de OpenAI')
    }
    
  } catch (error: any) {
    console.error('❌ Error probando OpenAI:', error.message)
    if (error.code === 'invalid_api_key') {
      console.log('🔑 La API key no es válida')
    } else if (error.code === 'insufficient_quota') {
      console.log('💳 No hay saldo suficiente en la cuenta de OpenAI')
    } else {
      console.log('⚠️ Error inesperado:', error.code)
    }
  }
}

if (require.main === module) {
  testRealAnalysis().catch(console.error)
}

export { testRealAnalysis }