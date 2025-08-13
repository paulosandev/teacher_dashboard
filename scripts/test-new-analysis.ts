#!/usr/bin/env npx tsx

/**
 * Script para probar la nueva funcionalidad de análisis real
 * Verifica que el análisis se guarda correctamente en BD
 */

import { prisma } from '../lib/db/prisma'
import { moodleClient } from '../lib/moodle/api-client'

const USUARIO_TEST = 'cesar.espindola'

async function testNewAnalysisFunction() {
  console.log('🧪 PRUEBA: Nueva funcionalidad de análisis real')
  console.log('==============================================')
  
  try {
    // 1. Obtener cursos del profesor
    console.log('📚 Paso 1: Obteniendo cursos del profesor...')
    const courses = await moodleClient.getTeacherCoursesWithGroups(USUARIO_TEST)
    
    if (courses.length === 0) {
      console.log('❌ No se encontraron cursos')
      return
    }
    
    const course = courses[0]
    const group = course.groups[0]
    
    console.log(`✅ Curso: ${course.name} (ID: ${course.id})`)
    console.log(`✅ Grupo: ${group.name} (ID: ${group.id})`)
    
    // 2. Verificar que el servidor responde
    console.log('\n🌐 Paso 2: Verificando servidor...')
    
    try {
      const healthCheck = await fetch('http://localhost:3000/api/health')
      console.log('Status servidor:', healthCheck.status)
    } catch (error) {
      console.log('❌ Servidor no disponible')
      return
    }
    
    // 3. Probar endpoint (sin autenticación, pero debe responder)
    console.log('\n📡 Paso 3: Probando endpoint de análisis...')
    
    const response = await fetch('http://localhost:3000/api/analysis/check-and-generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        courseId: course.id,
        groupId: group.id
      })
    })
    
    const result = await response.json()
    console.log('Respuesta HTTP:', response.status)
    console.log('Resultado:', JSON.stringify(result, null, 2))
    
    if (response.status === 401) {
      console.log('✅ Endpoint funciona (requiere autenticación, como esperado)')
    } else if (response.ok && result.success) {
      console.log('🎉 ¡Análisis generado exitosamente!')
      
      // Verificar en BD
      const latestAnalysis = await prisma.analysisResult.findFirst({
        where: {
          courseId: course.id,
          isLatest: true
        },
        orderBy: {
          processedAt: 'desc'
        }
      })
      
      if (latestAnalysis) {
        console.log('\n💾 Análisis encontrado en BD:')
        console.log('- ID:', latestAnalysis.id)
        console.log('- Tipo:', latestAnalysis.analysisType)
        console.log('- Fecha:', latestAnalysis.processedAt.toISOString())
        console.log('- Es último:', latestAnalysis.isLatest)
      }
    }
    
    // 4. Verificar estado de los análisis existentes
    console.log('\n📊 Paso 4: Estado actual de análisis en BD...')
    
    const allAnalysis = await prisma.analysisResult.findMany({
      where: {
        isLatest: true
      },
      select: {
        id: true,
        courseId: true,
        analysisType: true,
        processedAt: true,
        strengths: true,
        alerts: true,
        nextStep: true
      },
      orderBy: {
        processedAt: 'desc'
      },
      take: 5
    })
    
    console.log(`Total análisis "latest": ${allAnalysis.length}`)
    
    allAnalysis.forEach((analysis, index) => {
      console.log(`\n[${index + 1}] ${analysis.id}`)
      console.log(`   Curso: ${analysis.courseId}`)
      console.log(`   Tipo: ${analysis.analysisType}`)
      console.log(`   Fecha: ${analysis.processedAt.toISOString()}`)
      console.log(`   Próximo paso: ${analysis.nextStep}`)
    })
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testNewAnalysisFunction()
    .then(() => {
      console.log('\n🏁 Prueba completada')
      process.exit(0)
    })
    .catch((error) => {
      console.error('💥 Error crítico:', error)
      process.exit(1)
    })
}

export { testNewAnalysisFunction }
