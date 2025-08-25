import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { createSessionMoodleClient } from '@/lib/moodle/session-client'

const prisma = new PrismaClient()

export async function POST(req: NextRequest) {
  try {
    console.log('🕐 Iniciando actualización automática de análisis...')

    // Obtener todos los cursos que han sido analizados previamente
    // (que tienen al menos un análisis o han sido sincronizados)
    const coursesToUpdate = await prisma.course.findMany({
      where: {
        OR: [
          { lastSync: { not: null } },
          { analysisResults: { some: {} } }
        ],
        isActive: true
      },
      select: {
        id: true,
        moodleCourseId: true,
        name: true,
        lastSync: true,
        lastAnalyzedBy: true,
        groups: {
          select: {
            id: true,
            moodleGroupId: true,
            name: true
          }
        }
      }
    })

    console.log(`📊 Encontrados ${coursesToUpdate.length} cursos para actualizar`)

    if (coursesToUpdate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay cursos para actualizar',
        updated: 0
      })
    }

    // Crear cliente de Moodle con privilegios administrativos
    const moodleClient = createSessionMoodleClient(true) // server-side

    let updatedCount = 0
    const errors: string[] = []

    // Procesar cada curso
    for (const course of coursesToUpdate) {
      try {
        console.log(`🔄 Actualizando curso: ${course.name} (${course.moodleCourseId})`)
        
        // Para cada grupo en el curso
        for (const group of course.groups) {
          const courseGroupId = `${course.moodleCourseId}|${group.moodleGroupId}`
          
          // Llamar al endpoint de generación de análisis
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/generate-real`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AutoUpdate-Worker'
            },
            body: JSON.stringify({
              courseId: courseGroupId,
              groupId: group.moodleGroupId,
              isBackgroundUpdate: true
            })
          })

          if (response.ok) {
            updatedCount++
            console.log(`✅ Actualizado: ${course.name} - ${group.name}`)
            
            // Actualizar timestamp de última sincronización
            await prisma.course.update({
              where: { id: course.id },
              data: { lastSync: new Date() }
            })
            
            // Limpiar caché persistente para este curso para forzar recarga
            await prisma.courseCache.deleteMany({
              where: { courseId: courseGroupId }
            }).catch(error => console.log('Info: No había caché para limpiar'))
          } else {
            const errorText = await response.text()
            errors.push(`Error en ${course.name} - ${group.name}: ${errorText}`)
            console.error(`❌ Error actualizando ${course.name} - ${group.name}:`, errorText)
          }
        }

        // Si el curso no tiene grupos, procesarlo directamente
        if (course.groups.length === 0) {
          const courseGroupId = `${course.moodleCourseId}|0`
          
          const response = await fetch(`${process.env.NEXTAUTH_URL}/api/analysis/generate-real`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'AutoUpdate-Worker'
            },
            body: JSON.stringify({
              courseId: courseGroupId,
              groupId: '0',
              isBackgroundUpdate: true
            })
          })

          if (response.ok) {
            updatedCount++
            console.log(`✅ Actualizado curso sin grupos: ${course.name}`)
            
            await prisma.course.update({
              where: { id: course.id },
              data: { lastSync: new Date() }
            })
            
            // Limpiar caché persistente para este curso para forzar recarga
            await prisma.courseCache.deleteMany({
              where: { courseId: courseGroupId }
            }).catch(error => console.log('Info: No había caché para limpiar'))
          } else {
            const errorText = await response.text()
            errors.push(`Error en ${course.name}: ${errorText}`)
            console.error(`❌ Error actualizando ${course.name}:`, errorText)
          }
        }

      } catch (error) {
        const errorMsg = `Error procesando ${course.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`
        errors.push(errorMsg)
        console.error(errorMsg)
      }
    }

    const result = {
      success: true,
      message: `Actualización automática completada`,
      totalCourses: coursesToUpdate.length,
      updated: updatedCount,
      errors: errors.length > 0 ? errors : undefined
    }

    console.log('🎉 Actualización automática completada:', result)
    
    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Error en actualización automática:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}

// Endpoint GET para verificar el estado
export async function GET() {
  try {
    const coursesToUpdate = await prisma.course.findMany({
      where: {
        OR: [
          { lastSync: { not: null } },
          { analysisResults: { some: {} } }
        ],
        isActive: true
      },
      select: {
        id: true,
        moodleCourseId: true,
        name: true,
        lastSync: true,
        _count: {
          select: {
            analysisResults: true,
            groups: true
          }
        }
      },
      orderBy: { lastSync: 'desc' }
    })

    return NextResponse.json({
      success: true,
      totalCourses: coursesToUpdate.length,
      courses: coursesToUpdate.map(course => ({
        id: course.id,
        moodleCourseId: course.moodleCourseId,
        name: course.name,
        lastSync: course.lastSync,
        analysisCount: course._count.analysisResults,
        groupsCount: course._count.groups
      }))
    })

  } catch (error) {
    console.error('❌ Error obteniendo estado:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}