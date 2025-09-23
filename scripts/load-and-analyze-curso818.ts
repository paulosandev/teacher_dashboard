#!/usr/bin/env npx tsx
/**
 * Script para cargar específicamente las actividades del curso 818
 * del aula 101 y luego analizarlas
 */

import { MoodleAPIClient } from '@/lib/moodle/api-client'
import { BatchAnalysisService } from '@/lib/services/batch-analysis-service'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🎯 Proceso específico: Cargar curso 818 del aula 101')
  console.log('📍 Aula: 101')
  console.log('📚 Curso: 818')
  console.log('=' * 50)

  try {
    // PASO 1: Conectar a Moodle del aula 101
    console.log('\n📡 PASO 1: Conectando a aula 101...')

    // Usar token de servicio del aula 101
    const token = process.env.MOODLE_SERVICE_TOKEN_AULA101
    if (!token) {
      throw new Error('Token de servicio del aula 101 no encontrado')
    }

    const moodleClient = new MoodleAPIClient('https://aula101.utel.edu.mx', token)
    console.log('✅ Cliente Moodle configurado para aula 101')

    // PASO 2: Obtener datos del curso 818
    console.log('\n📚 PASO 2: Obteniendo datos del curso 818...')

    // Verificar que el curso existe
    try {
      const courseContents = await moodleClient.getCourseContents(818)
      console.log(`✅ Curso 818 encontrado con ${courseContents.length} secciones`)

      // Obtener foros del curso
      const forums = await moodleClient.getCourseForums(818)
      console.log(`📝 Encontrados ${forums.length} foros`)

      // Obtener asignaciones del curso
      const assignments = await moodleClient.getCourseAssignments(818)
      console.log(`📋 Encontradas ${assignments.length} asignaciones`)

      const totalActivities = forums.length + assignments.length
      console.log(`🎯 Total de actividades: ${totalActivities}`)

      if (totalActivities === 0) {
        console.log('⚠️ No se encontraron actividades en el curso 818')
        return
      }

      // PASO 3: Guardar actividades en la base de datos
      console.log('\n💾 PASO 3: Guardando actividades en la base de datos...')

      let savedCount = 0

      // Guardar foros
      for (const forum of forums) {
        try {
          const activity = {
            id: `101-818-forum-${forum.id}`,
            aulaId: '101',
            courseId: 818,
            activityId: forum.id,
            type: 'forum',
            name: forum.name,
            description: forum.intro || '',
            visible: true,
            url: `https://aula101.utel.edu.mx/mod/forum/view.php?id=${forum.cmid}`,
            forumData: forum,
            rawData: forum,
            needsAnalysis: true,
            analysisCount: 0
          }

          await prisma.courseActivity.upsert({
            where: { id: activity.id },
            update: activity,
            create: activity
          })

          console.log(`   ✅ Foro guardado: ${forum.name}`)
          savedCount++
        } catch (error) {
          console.log(`   ❌ Error guardando foro ${forum.name}:`, error)
        }
      }

      // Guardar asignaciones
      for (const assignment of assignments) {
        try {
          const activity = {
            id: `101-818-assign-${assignment.id}`,
            aulaId: '101',
            courseId: 818,
            activityId: assignment.id,
            type: 'assign',
            name: assignment.name,
            description: assignment.intro || '',
            dueDate: assignment.duedate ? new Date(assignment.duedate * 1000) : null,
            visible: true,
            url: `https://aula101.utel.edu.mx/mod/assign/view.php?id=${assignment.cmid}`,
            assignmentData: assignment,
            rawData: assignment,
            needsAnalysis: true,
            analysisCount: 0
          }

          await prisma.courseActivity.upsert({
            where: { id: activity.id },
            update: activity,
            create: activity
          })

          console.log(`   ✅ Asignación guardada: ${assignment.name}`)
          savedCount++
        } catch (error) {
          console.log(`   ❌ Error guardando asignación ${assignment.name}:`, error)
        }
      }

      console.log(`✅ Guardadas ${savedCount} actividades del curso 818`)

      // PASO 4: Analizar las actividades cargadas
      console.log('\n🧠 PASO 4: Analizando actividades con nuevos prompts...')

      const batchService = BatchAnalysisService.getInstance()
      const analysisResult = await batchService.analyzeSpecificActivities({
        aulaId: '101',
        courseId: '818',
        forceReAnalysis: true
      })

      console.log('\n✅ ========== PROCESO COMPLETADO ==========')
      console.log('📊 Resumen final:')
      console.log(`   - Actividades cargadas: ${savedCount}`)
      console.log(`   - Actividades analizadas: ${analysisResult.processedActivities}`)
      console.log(`   - Análisis generados: ${analysisResult.generatedAnalyses}`)
      console.log(`   - Errores: ${analysisResult.errors.length}`)

      if (analysisResult.errors.length > 0) {
        console.log('\n❌ Errores encontrados:')
        analysisResult.errors.forEach((error, i) => {
          console.log(`   ${i + 1}. ${error}`)
        })
      }

      console.log('\n🎉 ¡Proceso completado! El curso 818 ya está cargado y analizado.')
      console.log('================================================')

    } catch (error) {
      console.error('❌ Error accediendo al curso 818:', error)
      console.log('💡 Esto puede indicar que:')
      console.log('   - El curso 818 no existe en el aula 101')
      console.log('   - El curso no está activo')
      console.log('   - No tienes permisos para acceder al curso')
    }

  } catch (error) {
    console.error('❌ Error en el proceso:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)