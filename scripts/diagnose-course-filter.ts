#!/usr/bin/env tsx

/**
 * Script para diagnosticar el problema del filtro de cursos
 * Identifica por qué se muestran cursos donde el usuario no es profesor
 */

import { prisma } from '@/lib/db/prisma'
import { moodleClient } from '@/lib/moodle/api-client'

async function main() {
  console.log('🔍 DIAGNÓSTICO: Filtro de cursos por profesor')
  console.log('=' .repeat(60))

  // 1. Verificar usuarios en la base de datos
  console.log('\n1️⃣ USUARIOS EN BASE DE DATOS:')
  const users = await prisma.user.findMany({
    include: {
      courses: {
        include: {
          groups: true
        }
      }
    }
  })

  users.forEach(user => {
    console.log(`👤 ${user.name} (${user.username} | ${user.matricula})`)
    console.log(`   📧 ${user.email}`)
    console.log(`   📚 Cursos locales: ${user.courses.length}`)
    user.courses.forEach(course => {
      console.log(`      - ${course.name} (${course.shortName}) - ${course.groups.length} grupos`)
    })
    console.log()
  })

  // 2. Para cada usuario, probar el filtro de Moodle
  console.log('\n2️⃣ PRUEBA DE FILTRO MOODLE:')
  for (const user of users) {
    console.log(`\n🧪 Probando usuario: ${user.name} (${user.matricula})`)
    
    try {
      // Probar conexión primero
      const isConnected = await moodleClient.testConnection()
      if (!isConnected) {
        console.log('   ❌ Sin conexión a Moodle')
        continue
      }

      // Obtener cursos del profesor desde Moodle
      const moodleCourses = await moodleClient.getTeacherCoursesWithGroups(user.matricula)
      
      console.log(`   📊 RESULTADO: ${moodleCourses.length} cursos en Moodle`)
      
      if (moodleCourses.length > 0) {
        moodleCourses.forEach(course => {
          console.log(`      ✅ ${course.name} (${course.shortName}) - ${course.groups.length} grupos`)
          course.groups.forEach(group => {
            console.log(`         - ${group.name}`)
          })
        })
      } else {
        console.log('   ⚠️ No se encontraron cursos para este profesor en Moodle')
      }

    } catch (error) {
      console.log(`   ❌ Error obteniendo cursos de Moodle: ${error instanceof Error ? error.message : error}`)
    }
  }

  // 3. Verificar mapeo de usuarios en el cliente Moodle
  console.log('\n3️⃣ MAPEO DE USUARIOS EN MOODLE CLIENT:')
  for (const user of users) {
    try {
      const moodleUser = await (moodleClient as any).getUserByUsername(user.matricula)
      if (moodleUser) {
        console.log(`✅ ${user.matricula} → Moodle ID: ${moodleUser.id} (${moodleUser.email})`)
      } else {
        console.log(`❌ ${user.matricula} → No encontrado en mapeo de Moodle`)
      }
    } catch (error) {
      console.log(`❌ ${user.matricula} → Error: ${error instanceof Error ? error.message : error}`)
    }
  }

  // 4. Verificar análisis existentes
  console.log('\n4️⃣ ANÁLISIS EXISTENTES:')
  const analysisResults = await prisma.analysisResult.findMany({
    where: { isLatest: true },
    include: {
      activity: { include: { course: true } },
      forum: { include: { course: true } },
      group: { include: { course: true } }
    }
  })

  console.log(`📊 Total de análisis: ${analysisResults.length}`)
  analysisResults.forEach(result => {
    const courseName = result.activity?.course.name || result.forum?.course.name || result.group?.course.name || 'Sin curso'
    const itemName = result.activity?.name || result.forum?.name || result.group?.name || 'Sin nombre'
    console.log(`   - ${result.analysisType}: ${itemName} en ${courseName}`)
  })

  console.log('\n✅ Diagnóstico completado')
}

main()
  .catch((error) => {
    console.error('💥 Error en diagnóstico:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
