import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { prisma } from '@/lib/db/prisma'
import { decrypt } from '@/lib/utils/encryption'
import { MoodleAPIClient } from '@/lib/moodle/api-client'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Buscar token del usuario
    const userToken = await prisma.userMoodleToken.findUnique({
      where: { userId: session.user.id }
    })

    if (!userToken || !userToken.token) {
      return NextResponse.json({ 
        error: 'No se encontró un token configurado' 
      }, { status: 404 })
    }

    // Desencriptar token
    const decryptedToken = decrypt(userToken.token)
    
    // Crear cliente de Moodle con el token del usuario
    const moodleClient = new MoodleAPIClient(
      process.env.MOODLE_API_URL!,
      decryptedToken
    )

    // Probar el token obteniendo información del usuario
    try {
      const userInfo = await moodleClient.getUserInfo()
      
      if (!userInfo) {
        return NextResponse.json({ 
          success: false,
          error: 'No se pudo obtener información del usuario' 
        }, { status: 400 })
      }

      // Obtener cursos donde es profesor
      const allCourses = await moodleClient.getUserCourses(userInfo.id)
      
      // Filtrar solo cursos donde es profesor
      let teacherCourses = []
      if (allCourses && allCourses.length > 0) {
        for (const course of allCourses) {
          const enrolledUsers = await moodleClient.getEnrolledUsers(course.id)
          const currentUser = enrolledUsers?.find((u: any) => u.id === userInfo.id)
          
          if (currentUser?.roles?.some((r: any) => 
            r.roleid === 3 || // editingteacher
            r.roleid === 4 || // teacher
            r.shortname === 'editingteacher' ||
            r.shortname === 'teacher'
          )) {
            teacherCourses.push(course)
          }
        }
      }

      return NextResponse.json({
        success: true,
        userInfo: {
          id: userInfo.id,
          username: userInfo.username,
          fullname: userInfo.fullname,
          email: userInfo.email
        },
        coursesCount: teacherCourses.length,
        courses: teacherCourses.slice(0, 3).map(c => ({
          id: c.id,
          fullname: c.fullname,
          shortname: c.shortname
        }))
      })

    } catch (moodleError: any) {
      console.error('Error al probar token:', moodleError)
      
      // Verificar si es un error de autenticación
      if (moodleError.message?.includes('Invalid token') || 
          moodleError.message?.includes('invalidtoken')) {
        return NextResponse.json({ 
          success: false,
          error: 'Token inválido o expirado' 
        }, { status: 401 })
      }

      return NextResponse.json({ 
        success: false,
        error: moodleError.message || 'Error al conectar con Moodle' 
      }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Error en prueba de token:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Error interno del servidor' 
    }, { status: 500 })
  }
}
