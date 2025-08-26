import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClientEnhanced } from '@/lib/moodle/client-enhanced'
import { prisma } from '@/lib/db/prisma'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
      // Probar conexión con Moodle usando el cliente del usuario
      const moodleClient = new MoodleAPIClientEnhanced(session.user.id, session.user.email)
      
      try {
        const userInfo = await moodleClient.getCurrentUser()
        const isConnected = !!userInfo
        
        return NextResponse.json({
          success: isConnected,
          message: isConnected 
            ? `Conexión exitosa como ${userInfo.fullname}` 
            : 'Error al conectar con Moodle',
          userInfo: isConnected ? userInfo : null
        })
      } catch (error) {
        return NextResponse.json({
          success: false,
          message: 'Error al conectar con Moodle',
          error: error instanceof Error ? error.message : 'Error desconocido'
        })
      }
    }

    if (action === 'courses') {
      console.log('🔐 SESIÓN ACTUAL:')
      console.log(`   Usuario: ${session.user.name || 'Sin nombre'}`)
      console.log(`   Email: ${session.user.email}`)
      console.log(`   ID: ${session.user.id}`)
      
      // Crear cliente con contexto del usuario
      const moodleClient = new MoodleAPIClientEnhanced(session.user.id, session.user.email)
      
      try {
        console.log(`🔍 Obteniendo cursos donde el usuario es profesor...`)
        
        const teacherCourses = await moodleClient.getUserCourses()
        
        // Para cada curso, obtener sus grupos
        const coursesWithGroups = []
        
        for (const course of teacherCourses) {
          try {
            const groups = await moodleClient.getCourseGroups(course.id)
            
            coursesWithGroups.push({
              ...course,
              groups: groups || []
            })
          } catch (groupError) {
            console.log(`⚠️ Error obteniendo grupos del curso ${course.shortname}: ${groupError instanceof Error ? groupError.message : groupError}`)
            // Añadir el curso sin grupos
            coursesWithGroups.push({
              ...course,
              groups: []
            })
          }
        }
        
        console.log(`📚 Total de ${coursesWithGroups.length} cursos obtenidos`)
        
        return NextResponse.json({
          success: true,
          data: coursesWithGroups,
          count: coursesWithGroups.length,
          usingUserToken: true
        })
        
      } catch (error) {
        console.error('Error obteniendo cursos:', error)
        return NextResponse.json(
          { 
            error: 'Error al obtener cursos de Moodle',
            details: error instanceof Error ? error.message : 'Error desconocido',
            needsToken: error instanceof Error && error.message.includes('token')
          },
          { status: 500 }
        )
      }
    }

    if (action === 'forums') {
      const courseId = parseInt(searchParams.get('courseId') || '0')
      
      if (!courseId) {
        return NextResponse.json(
          { error: 'Se requiere courseId' },
          { status: 400 }
        )
      }
      
      // Crear cliente con contexto del usuario
      const moodleClient = new MoodleAPIClientEnhanced(session.user.id, session.user.email)
      
      try {
        // Obtener foros del curso
        const forums = await moodleClient.getCourseForums(courseId)
        
        return NextResponse.json({
          success: true,
          data: forums,
          count: forums.length,
        })
      } catch (error) {
        return NextResponse.json(
          { 
            error: 'Error al obtener foros',
            details: error instanceof Error ? error.message : 'Error desconocido'
          },
          { status: 500 }
        )
      }
    }

    if (action === 'discussions') {
      const forumId = parseInt(searchParams.get('forumId') || '0')
      
      if (!forumId) {
        return NextResponse.json(
          { error: 'Se requiere forumId' },
          { status: 400 }
        )
      }
      
      // Crear cliente con contexto del usuario
      const moodleClient = new MoodleAPIClientEnhanced(session.user.id, session.user.email)
      
      try {
        // Obtener discusiones del foro
        const discussions = await moodleClient.getForumDiscussions(forumId)
        
        return NextResponse.json({
          success: true,
          data: discussions,
          count: discussions.length,
        })
      } catch (error) {
        return NextResponse.json(
          { 
            error: 'Error al obtener discusiones',
            details: error instanceof Error ? error.message : 'Error desconocido'
          },
          { status: 500 }
        )
      }
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
