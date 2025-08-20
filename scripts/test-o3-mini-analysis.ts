/**
 * Probar análisis con modelo o3-mini corregido
 */

import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

const hasValidApiKey = process.env.OPENAI_API_KEY && 
  process.env.OPENAI_API_KEY !== 'your-openai-api-key' && 
  process.env.OPENAI_API_KEY.startsWith('sk-')

const openai = hasValidApiKey ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

console.log('🧪 Probando análisis educativo con o3-mini...')
console.log('=' .repeat(60))

if (!hasValidApiKey) {
  console.log('❌ API key de OpenAI no válida')
  process.exit(1)
}

async function testO3MiniAnalysis() {
  try {
    // Prompt similar al usado en el sistema real
    const testPrompt = `
Eres un experto en análisis educativo. Analiza la siguiente DISCUSIÓN EDUCATIVA y genera un análisis con formato estructurado dinámico:

## CONTEXTO DE LA DISCUSIÓN:
- **Título**: "Discusión de Prueba"
- **Descripción**: Discusión para probar el sistema de análisis
- **Posts totales**: 5
- **Contenido inicial**: Esta es una prueba del sistema de análisis educativo

## DATOS DE PARTICIPACIÓN:
- 3 estudiantes participaron
- 2 respuestas promedio por estudiante

---

**GENERA UN ANÁLISIS CON SECCIONES DINÁMICAS Y ESPECÍFICAS AL CONTEXTO**

Crea entre 5-7 secciones usando títulos descriptivos que reflejen el contenido real. Evita títulos genéricos.

**ESTRUCTURA REQUERIDA:**

## [Título Dinámico 1]
[Contenido específico y detallado - mínimo 3 líneas]

## [Título Dinámico 2]
[Contenido específico y detallado - mínimo 3 líneas]

## [Título Dinámico 3]
[Contenido específico y detallado - mínimo 3 líneas]

## RESUMEN_EJECUTIVO
- [Punto clave de la primera sección - máximo 15 palabras]
- [Punto clave de la segunda sección - máximo 15 palabras]
- [Punto clave de la tercera sección - máximo 15 palabras]

**IMPORTANTE**: 
- Usa títulos específicos al contexto, NO genéricos
- Cada sección debe tener contenido sustancial (mínimo 50 palabras)
`

    console.log('🚀 Enviando análisis de prueba a o3-mini...')
    console.log(`📝 Prompt: ${testPrompt.substring(0, 100)}...`)
    
    const startTime = Date.now()
    
    const completion = await openai!.chat.completions.create({
      model: "o3-mini",
      messages: [
        {
          role: "system",
          content: "Eres un experto en análisis educativo. Proporciona insights profesionales usando formato Markdown para mejorar la presentación visual."
        },
        {
          role: "user",
          content: testPrompt
        }
      ],
      max_completion_tokens: 2500
    })

    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000

    const response = completion.choices[0]?.message?.content || ''
    
    console.log('\n✅ ANÁLISIS GENERADO EXITOSAMENTE!')
    console.log(`⏱️ Tiempo: ${duration}s`)
    console.log(`📊 Tokens usados: ${completion.usage?.total_tokens || 'N/A'}`)
    console.log(`📝 Caracteres generados: ${response.length}`)
    
    console.log('\n📄 CONTENIDO DEL ANÁLISIS:')
    console.log('=' .repeat(50))
    console.log(response)
    console.log('=' .repeat(50))
    
    // Verificar formato estructurado
    console.log('\n🔍 VERIFICACIÓN DE FORMATO:')
    const hasHeaders = response.includes('##')
    const hasResumenEjecutivo = response.includes('RESUMEN_EJECUTIVO')
    const hasMultipleSections = (response.match(/##/g) || []).length >= 3
    
    console.log(`   - Encabezados (##): ${hasHeaders ? '✅' : '❌'}`)
    console.log(`   - Resumen ejecutivo: ${hasResumenEjecutivo ? '✅' : '❌'}`)
    console.log(`   - Múltiples secciones (3+): ${hasMultipleSections ? '✅' : '❌'}`)
    
    const formatOk = hasHeaders && hasResumenEjecutivo && hasMultipleSections
    console.log(`   - Formato correcto: ${formatOk ? '✅' : '❌'}`)
    
    if (formatOk) {
      console.log('\n🎯 RESULTADO: ¡o3-mini funciona correctamente!')
    } else {
      console.log('\n⚠️ RESULTADO: Formato necesita ajustes')
    }
    
  } catch (error: any) {
    console.log(`❌ ERROR AL PROBAR o3-mini:`)
    console.log(`   Mensaje: ${error.message}`)
    console.log(`   Código: ${error.code || 'N/A'}`)
    console.log(`   Estado: ${error.status || 'N/A'}`)
    
    if (error.code === 'model_not_found') {
      console.log('\n💡 SUGERENCIA: El modelo o3-mini podría no estar disponible')
    } else if (error.message?.includes('max_tokens')) {
      console.log('\n💡 SUGERENCIA: Error de configuración de tokens')
    }
  }
}

// Ejecutar prueba
testO3MiniAnalysis().catch(console.error)