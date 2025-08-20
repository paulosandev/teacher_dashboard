/**
 * Script para probar disponibilidad de modelos de OpenAI
 */

import OpenAI from 'openai'
import * as dotenv from 'dotenv'

dotenv.config()

const hasValidApiKey = process.env.OPENAI_API_KEY && 
  process.env.OPENAI_API_KEY !== 'your-openai-api-key' && 
  process.env.OPENAI_API_KEY.startsWith('sk-')

console.log('🔍 Probando modelos disponibles de OpenAI...')
console.log('=' .repeat(60))

if (!hasValidApiKey) {
  console.log('❌ API key de OpenAI no válida')
  process.exit(1)
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function testModels() {
  // Lista de modelos a probar
  const modelsToTest = [
    'o3-mini', 
    'gpt-4', 
    'gpt-4-turbo',
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-3.5-turbo'
  ]

  console.log('📋 Probando modelos disponibles...\n')

  for (const model of modelsToTest) {
    try {
      console.log(`🧪 Probando modelo: ${model}`)
      
      const completion = await openai.chat.completions.create({
        model: model,
        messages: [
          {
            role: "user",
            content: "Responde solo: 'Funcionando'"
          }
        ],
        max_tokens: 10,
        temperature: 0
      })

      const response = completion.choices[0]?.message?.content?.trim()
      
      if (response) {
        console.log(`✅ ${model}: DISPONIBLE - Respuesta: "${response}"`)
      } else {
        console.log(`⚠️ ${model}: DISPONIBLE pero sin respuesta`)
      }
      
    } catch (error: any) {
      console.log(`❌ ${model}: NO DISPONIBLE - ${error.message}`)
      
      // Mostrar detalles del error si es relevante
      if (error.code === 'model_not_found') {
        console.log(`   💡 Modelo no encontrado`)
      } else if (error.code === 'insufficient_quota') {
        console.log(`   💡 Cuota insuficiente`)
      } else if (error.status === 404) {
        console.log(`   💡 Modelo no existe o no disponible para tu cuenta`)
      }
    }
    
    console.log('') // Línea en blanco
  }

  // Listar modelos disponibles
  try {
    console.log('📋 Obteniendo lista oficial de modelos...')
    const models = await openai.models.list()
    
    console.log('\n🎯 MODELOS DISPONIBLES EN TU CUENTA:')
    const sortedModels = models.data
      .filter(m => m.id.includes('gpt') || m.id.includes('o3'))
      .sort((a, b) => a.id.localeCompare(b.id))
    
    sortedModels.forEach(model => {
      console.log(`   - ${model.id}`)
    })
    
  } catch (error: any) {
    console.log(`❌ No se pudo obtener lista de modelos: ${error.message}`)
  }
}

// Ejecutar prueba
testModels().catch(console.error)