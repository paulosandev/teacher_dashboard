import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSessionMoodleClient } from '@/lib/moodle/session-client'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autorizado - sesión requerida' }, { status: 401 })
    }

    console.log('🔍 OBTENIENDO CURSOS PARA TESTING...')
    console.log(`👤 Usuario: ${session.user.name} (${session.user.matricula})`)

    // Crear cliente basado en sesión
    const sessionClient = createSessionMoodleClient(true) // server-side

    // Probar conexión
    const isConnected = await sessionClient.testConnection()
    if (!isConnected) {
      return NextResponse.json({ error: 'No se pudo conectar con Moodle' }, { status: 503 })
    }

    // Obtener cursos
    const coursesWithGroups = await sessionClient.getTeacherCourses()
    
    console.log('📚 CURSOS DONDE SOY PROFESOR:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📊 Total de cursos encontrados: ${coursesWithGroups.length}`)
    
    coursesWithGroups.forEach((course, index) => {
      console.log(`\n📖 CURSO ${index + 1}:`)
      console.log(`   ID: ${course.id}`)
      console.log(`   Nombre: ${course.name || course.fullname}`)
      console.log(`   Nombre corto: ${course.shortname || 'N/A'}`)
      console.log(`   Visible: ${course.visible ? 'Sí' : 'No'}`)
      
      if (course.groups && course.groups.length > 0) {
        console.log(`   👥 Grupos (${course.groups.length}):`)
        course.groups.forEach((group, groupIndex) => {
          console.log(`      ${groupIndex + 1}. ${group.name} (ID: ${group.id})`)
        })
      } else {
        console.log(`   👥 Grupos: Sin grupos definidos`)
      }
      
      // Mostrar información adicional si está disponible
      if (course.summary) {
        console.log(`   📝 Descripción: ${course.summary.substring(0, 100)}${course.summary.length > 100 ? '...' : ''}`)
      }
      
      if (course.categoryid) {
        console.log(`   📁 Categoría ID: ${course.categoryid}`)
      }
      
      if (course.startdate) {
        const startDate = new Date(course.startdate * 1000)
        console.log(`   📅 Fecha inicio: ${startDate.toLocaleDateString()}`)
      }
      
      if (course.enddate && course.enddate > 0) {
        const endDate = new Date(course.enddate * 1000)
        console.log(`   📅 Fecha fin: ${endDate.toLocaleDateString()}`)
      }
    })
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return NextResponse.json({
      success: true,
      coursesCount: coursesWithGroups.length,
      courses: coursesWithGroups.map(course => ({
        id: course.id,
        name: course.name || course.fullname,
        shortname: course.shortname,
        visible: course.visible,
        groupsCount: course.groups?.length || 0,
        groups: course.groups?.map(g => ({ id: g.id, name: g.name })) || []
      }))
    })

  } catch (error: any) {
    console.error('❌ Error obteniendo cursos:', error)
    return NextResponse.json({
      error: 'Error al obtener cursos',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }, { status: 500 })
  }
}