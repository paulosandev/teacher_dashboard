#!/usr/bin/env tsx

/**
 * Script para probar el mapeo de courseIds entre BD local y Moodle
 */

import { prisma } from '@/lib/db/prisma'

async function main() {
  console.log('🔍 PRUEBA: Mapeo de courseIds entre BD local y Moodle')
  console.log('=' .repeat(60))

  // Obtener usuario de prueba
  const user = await prisma.user.findUnique({
    where: { username: 'cesar.espindola' },
    include: {
      courses: {
        include: {
          groups: true,
        }
      }
    }
  })

  if (!user) {
    console.log('❌ Usuario no encontrado')
    return
  }

  console.log(`\n👤 USUARIO: ${user.name} (${user.matricula})`)
  console.log('📚 CURSOS EN BD LOCAL:')
  
  // Crear mapeo bidireccional
  const courseIdMapping = new Map<string, string>()
  
  user.courses.forEach(course => {
    console.log(`   - ${course.name} (${course.shortName})`)
    console.log(`     📌 ID Local: ${course.id}`)
    console.log(`     🌐 ID Moodle: ${course.moodleCourseId}`)
    
    // Crear mapeo bidireccional
    courseIdMapping.set(course.id, course.moodleCourseId) // local -> moodle
    courseIdMapping.set(course.moodleCourseId, course.id) // moodle -> local
    console.log('')
  })

  // Probar mapeo
  console.log('🔄 MAPEO BIDIRECCIONAL:')
  courseIdMapping.forEach((value, key) => {
    console.log(`   ${key} → ${value}`)
  })

  // Obtener análisis existentes
  const analysisResults = await prisma.analysisResult.findMany({
    where: { isLatest: true },
    include: {
      activity: { include: { course: true } },
      forum: { include: { course: true } },
      group: { include: { course: true } }
    }
  })

  console.log(`\n📊 ANÁLISIS EXISTENTES (${analysisResults.length}):`)
  analysisResults.forEach(result => {
    const localCourseId = result.activity?.courseId || result.forum?.courseId || ''
    const courseName = result.activity?.course.name || result.forum?.course.name || result.group?.course.name || 'Sin curso'
    const moodleCourseId = courseIdMapping.get(localCourseId) || 'No encontrado'
    const itemName = result.activity?.name || result.forum?.name || result.group?.name || 'Sin nombre'
    
    console.log(`\n   📄 ${result.analysisType}: ${itemName}`)
    console.log(`      🏫 Curso: ${courseName}`)
    console.log(`      📌 ID Local: ${localCourseId}`)
    console.log(`      🌐 ID Moodle: ${moodleCourseId}`)
    
    // Simular filtrado como en el dashboard
    console.log(`\n      🧪 SIMULACIÓN DE FILTRADO:`)
    
    // Modo Local: comparar con courseId local
    const localMatch = localCourseId === localCourseId
    console.log(`         Local: ${localCourseId} === ${localCourseId} → ${localMatch}`)
    
    // Modo Moodle: comparar con moodleCourseId
    const moodleTestId = courseIdMapping.get(localCourseId) || localCourseId
    const moodleMatch = moodleTestId === moodleCourseId
    console.log(`         Moodle: ${moodleTestId} === ${moodleCourseId} → ${moodleMatch}`)
  })

  console.log('\n✅ Prueba de mapeo completada')
}

main()
  .catch((error) => {
    console.error('💥 Error en prueba:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
