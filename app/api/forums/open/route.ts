import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { MoodleAPIClient } from '@/lib/moodle/api-client'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Verificar expiración del token
    if (session.user.tokenExpiry && new Date() > new Date(session.user.tokenExpiry)) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 401 })
    }

    // Obtener courseId de los query parameters
    const { searchParams } = new URL(request.url)
    const courseId = searchParams.get('courseId')

    if (!courseId) {
      return NextResponse.json({ error: 'courseId es requerido' }, { status: 400 })
    }

    console.log('💬 Obteniendo foros abiertos para curso:', courseId)

    // Crear cliente API con el token de la sesión
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, session.user.moodleToken)

    // Obtener foros del curso
    const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
      courseids: [parseInt(courseId)]
    })

    if (!forums || forums.length === 0) {
      console.log('❌ No se encontraron foros en el curso:', courseId)
      return NextResponse.json({ 
        forums: [],
        message: 'No se encontraron foros en este curso'
      })
    }

    // Función para verificar si un foro está abierto
    const isForumOpen = (forum: any) => {
      const now = Math.floor(Date.now() / 1000) // Timestamp actual en segundos
      
      // Si no hay fechas definidas, consideramos que está abierto
      if (!forum.duedate && !forum.cutoffdate && !forum.timeopen && !forum.timeclose) {
        return true
      }
      
      // Verificar fecha de apertura (timeopen)
      if (forum.timeopen && forum.timeopen > now) {
        return false // Aún no se ha abierto
      }
      
      // Verificar fecha de cierre (timeclose)
      if (forum.timeclose && forum.timeclose < now) {
        return false // Ya se cerró
      }
      
      // Verificar fecha límite (duedate) como referencia adicional
      if (forum.duedate && forum.duedate < now && !forum.timeclose) {
        return false // Pasó la fecha límite y no hay timeclose definido
      }
      
      return true // El foro está abierto
    }

    // Filtrar solo foros abiertos
    const openForums = forums.filter(isForumOpen)

    console.log(`🟢 Foros abiertos encontrados: ${openForums.length} de ${forums.length} totales`)

    // Formatear información de foros para el frontend
    const formattedForums = openForums.map(forum => ({
      id: forum.id,
      name: forum.name,
      intro: forum.intro ? forum.intro.replace(/<[^>]*>/g, '').trim() : '',
      type: forum.type || 'general',
      timeopen: forum.timeopen,
      timeclose: forum.timeclose,
      duedate: forum.duedate,
      maxdiscussions: forum.maxdiscussions,
      courseid: forum.course
    }))

    return NextResponse.json({
      forums: formattedForums,
      total: forums.length,
      open: openForums.length,
      closed: forums.length - openForums.length
    })

  } catch (error: any) {
    console.error('❌ Error obteniendo foros abiertos:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}