#!/usr/bin/env tsx

/**
 * Script para diagnosticar por qué no aparece el análisis después de generarlo
 */

import { prisma } from '@/lib/db/prisma'
import { moodleClient } from '@/lib/moodle/api-client'

async function main() {
  console.log('🔍 DIAGNÓSTICO: Problema del análisis simulado')
  console.log('=' .repeat(60))

  // 1. Verificar usuario César
  const user = await prisma.user.findUnique({
    where: { username: 'cesar.espindola' },
    include: {
      courses: {
        include: {
          groups: true
        }
      }
    }
  })

  if (!user) {
    console.log('❌ Usuario no encontrado')
    return
  }

  console.log(`👤 Usuario: ${user.name} (${user.matricula})`)
  console.log(`📚 Cursos locales: ${user.courses.length}`)
  
  user.courses.forEach(course => {
    console.log(`   - ${course.name} (Local ID: ${course.id})`)
    console.log(`     Moodle ID: ${course.moodleCourseId}`)
    console.log(`     Grupos: ${course.groups.length}`)
  })

  // 2. Obtener cursos de Moodle del usuario
  console.log('\n🌐 CURSOS DE MOODLE:')
  const moodleCourses = await moodleClient.getTeacherCoursesWithGroups(user.matricula)
  console.log(`📊 Cursos Moodle: ${moodleCourses.length}`)
  
  moodleCourses.forEach(course => {
    console.log(`   - ${course.name} (Moodle ID: ${course.id})`)
    console.log(`     Grupos: ${course.groups.length}`)
    course.groups.forEach(group => {
      console.log(`       * ${group.name} (ID: ${group.id})`)
    })
  })

  // 3. Verificar análisis existentes en BD
  console.log('\n📊 ANÁLISIS EN BASE DE DATOS:')
  const allAnalysis = await prisma.analysisResult.findMany({
    include: {
      activity: { include: { course: true } },
      forum: { include: { course: true } },
      group: { include: { course: true } }
    },
    orderBy: { processedAt: 'desc' }
  })

  console.log(`🔢 Total análisis: ${allAnalysis.length}`)
  allAnalysis.forEach(analysis => {
    const courseName = analysis.activity?.course.name || analysis.forum?.course.name || analysis.group?.course.name || 'Sin curso'
    const itemName = analysis.activity?.name || analysis.forum?.name || analysis.group?.name || 'Sin nombre'
    console.log(`   - ${analysis.analysisType}: ${itemName}`)
    console.log(`     Curso: ${courseName}`)
    console.log(`     CourseId: ${analysis.courseId || 'Sin courseId'}`)
    console.log(`     GroupId: ${analysis.groupId || 'Sin groupId'}`)
    console.log(`     Fecha: ${analysis.processedAt.toISOString()}`)
    console.log(`     isLatest: ${analysis.isLatest}`)
    console.log('')
  })

  // 4. Probar el contenido de un curso específico de Moodle
  if (moodleCourses.length > 0) {
    const testCourse = moodleCourses[0]
    console.log(`\n🧪 PROBANDO CONTENIDO DEL CURSO: ${testCourse.name}`)
    console.log(`   Moodle ID: ${testCourse.id}`)

    try {
      // Obtener foros
      const forums = await moodleClient.getCourseForums(parseInt(testCourse.id))
      console.log(`   📋 Foros encontrados: ${forums.length}`)
      
      forums.forEach(forum => {
        console.log(`      - ${forum.name} (ID: ${forum.id})`)
      })

      // Obtener contenido del curso
      const contents = await moodleClient.getCourseContents(parseInt(testCourse.id))
      console.log(`   📚 Secciones de contenido: ${contents.length}`)
      
      const totalActivities = contents.reduce((acc, section) => {
        return acc + (section.modules?.length || 0)
      }, 0)
      console.log(`   🎯 Total actividades: ${totalActivities}`)

    } catch (error) {
      console.log(`   ❌ Error obteniendo contenido: ${error}`)
    }
  }

  // 5. Simular el mapeo que hace el dashboard
  console.log('\n🔄 SIMULANDO MAPEO DEL DASHBOARD:')
  
  // Crear mapeo como en el dashboard
  const courseIdMapping = new Map<string, string>()
  user.courses.forEach(course => {
    courseIdMapping.set(course.id, course.moodleCourseId) // local -> moodle
    courseIdMapping.set(course.moodleCourseId, course.id) // moodle -> local
  })
  
  console.log('📋 Mapeo creado:')
  courseIdMapping.forEach((value, key) => {
    console.log(`   ${key} → ${value}`)
  })

  // 6. Identificar el problema principal
  console.log('\n⚠️ PROBLEMAS IDENTIFICADOS:')
  
  if (user.courses.length === 0) {
    console.log('   1. No hay cursos sincronizados en la BD local')
  }
  
  if (allAnalysis.length === 0) {
    console.log('   2. No hay análisis en la base de datos')
  } else {
    console.log('   2. Sí hay análisis en la BD, revisando mapeo...')
    
    // Verificar si los análisis tienen courseId que mapeen con Moodle
    allAnalysis.forEach(analysis => {
      const courseId = analysis.activity?.courseId || analysis.forum?.courseId || analysis.groupId
      if (courseId) {
        const moodleId = courseIdMapping.get(courseId)
        console.log(`      Análisis courseId: ${courseId} → Moodle ID: ${moodleId || 'NO MAPEADO'}`)
      }
    })
  }
  
  const hasLocalCourses = user.courses.length > 0
  const hasMoodleCourses = moodleCourses.length > 0
  const hasAnalysis = allAnalysis.length > 0
  
  console.log('\n📋 RESUMEN DEL PROBLEMA:')
  console.log(`   Local courses: ${hasLocalCourses ? '✅' : '❌'}`)
  console.log(`   Moodle courses: ${hasMoodleCourses ? '✅' : '❌'}`)
  console.log(`   Analysis in DB: ${hasAnalysis ? '✅' : '❌'}`)
  
  if (hasLocalCourses && hasAnalysis && hasMoodleCourses) {
    console.log('\n💡 POSIBLE CAUSA: El análisis simulado no se guarda en BD')
    console.log('   SOLUCIÓN: Implementar guardado real del análisis')
  } else if (!hasLocalCourses && hasMoodleCourses) {
    console.log('\n💡 POSIBLE CAUSA: No hay cursos sincronizados localmente')
    console.log('   SOLUCIÓN: Sincronizar cursos de Moodle a BD local')
  }
}

main()
  .catch((error) => {
    console.error('💥 Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
