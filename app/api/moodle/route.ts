import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { moodleClient } from '@/lib/moodle/api-client'
import { prisma } from '@/lib/db/prisma'

export async function GET(request: NextRequest) {
  try {
    // Verificar sesión
    const session = await getServerSession(authOptions)
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      )
    }

    // Obtener el parámetro de acción
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    if (action === 'test') {
      // Probar conexión con Moodle
      const isConnected = await moodleClient.testConnection()
      
      return NextResponse.json({
        success: isConnected,
        message: isConnected 
          ? 'Conexión con Moodle exitosa' 
          : 'Error al conectar con Moodle',
      })
    }

    if (action === 'courses') {
      // Intentar primero con el plugin personalizado que no requiere userId
      // Si se proporciona userId, se usará como fallback
      const moodleUserId = searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined
      
      // Obtener cursos con grupos (ahora userId es opcional)
      const coursesWithGroups = await moodleClient.getCoursesWithGroups(moodleUserId)
      
      // Opcionalmente, guardar/actualizar en base de datos local
      if (coursesWithGroups.length > 0) {
        console.log(`📚 Obtenidos ${coursesWithGroups.length} cursos de Moodle`)
        
        // Aquí podrías sincronizar con la base de datos local si lo deseas
        // Por ejemplo:
        /*
        for (const course of coursesWithGroups) {
          await prisma.course.upsert({
            where: { 
              moodleId: parseInt(course.id) 
            },
            update: {
              name: course.name,
              shortName: course.shortName,
            },
            create: {
              moodleId: parseInt(course.id),
              name: course.name,
              shortName: course.shortName,
              professorId: session.user.id,
            },
          })
          
          // Sincronizar grupos...
        }
        */
      }
      
      return NextResponse.json({
        success: true,
        data: coursesWithGroups,
        count: coursesWithGroups.length,
      })
    }

    if (action === 'forums') {
      const courseId = parseInt(searchParams.get('courseId') || '0')
      
      if (!courseId) {
        return NextResponse.json(
          { error: 'Se requiere courseId' },
          { status: 400 }
        )
      }
      
      // Obtener foros del curso
      const forums = await moodleClient.getCourseForums(courseId)
      
      return NextResponse.json({
        success: true,
        data: forums,
        count: forums.length,
      })
    }

    if (action === 'discussions') {
      const forumId = parseInt(searchParams.get('forumId') || '0')
      
      if (!forumId) {
        return NextResponse.json(
          { error: 'Se requiere forumId' },
          { status: 400 }
        )
      }
      
      // Obtener discusiones del foro
      const discussions = await moodleClient.getForumDiscussions(forumId)
      
      return NextResponse.json({
        success: true,
        data: discussions,
        count: discussions.length,
      })
    }

    // Acción por defecto: obtener info general
    return NextResponse.json({
      message: 'API de Moodle',
      availableActions: [
        'test - Probar conexión',
        'courses - Obtener cursos y grupos',
        'forums - Obtener foros de un curso (requiere courseId)',
        'discussions - Obtener discusiones de un foro (requiere forumId)',
      ],
    })
    
  } catch (error) {
    console.error('Error en API de Moodle:', error)
    return NextResponse.json(
      { 
        error: 'Error al procesar solicitud',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    )
  }
}
