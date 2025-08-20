import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSessionMoodleClient } from '@/lib/moodle/session-client'
import { IntelligentDashboardContent } from '@/components/dashboard/intelligent-dashboard-content'

export default async function IntelligentDashboardPage() {
  // Verificar autenticación
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.moodleToken) {
    redirect('/auth/login')
  }

  // Verificar expiración del token
  if (session.user.tokenExpiry && new Date() > new Date(session.user.tokenExpiry)) {
    redirect('/auth/login')
  }

  console.log('📊 Cargando dashboard basado en sesión para:', session.user.name)
  console.log('🆔 Matrícula:', session.user.matricula)
  console.log('🔑 Token válido hasta:', session.user.tokenExpiry)

  let courses: any[] = []
  let connectionStatus: 'connected' | 'disconnected' | 'failed' | 'error' = 'disconnected'
  let error: string | null = null

  try {
    // Crear cliente basado en sesión
    const sessionClient = createSessionMoodleClient(true) // server-side

    // Probar conexión
    const isConnected = await sessionClient.testConnection()
    connectionStatus = isConnected ? 'connected' : 'failed'

    if (isConnected) {
      // Obtener combinaciones curso-grupo donde el profesor está enrolado
      try {
        console.log('🎯 Intentando obtener cursos-grupos...')
        const teacherCourseGroups = await sessionClient.getTeacherCourseGroups()
        
        if (!teacherCourseGroups || teacherCourseGroups.length === 0) {
          console.warn('⚠️ No se obtuvieron cursos-grupos, intentando método legacy...')
          // Fallback al método legacy
          const legacyCourses = await sessionClient.getTeacherCourses()
          courses = legacyCourses.map(course => ({
            id: `${course.id}|0`, // Formato fallback sin grupos
            name: `${course.name || course.fullname} | Sin Grupos (Legacy)`,
            shortname: course.shortname,
            fullname: course.fullname,
            courseId: course.id.toString(),
            groupId: '0',
            courseName: course.name || course.fullname,
            groupName: 'Sin Grupos (Legacy)',
            visible: course.visible,
            summary: course.summary,
            startdate: course.startdate,
            enddate: course.enddate,
            course: course,
            group: null
          }))
        } else {
          // Convertir a formato para el selector
          courses = teacherCourseGroups.map(item => ({
            id: `${item.courseId}|${item.groupId}`, // Formato "courseId|groupId"
            name: item.displayName, // "Curso Name | Grupo Name"
            shortname: item.courseShortname,
            fullname: item.courseFullname,
            courseId: item.courseId,
            groupId: item.groupId,
            courseName: item.courseName,
            groupName: item.groupName,
            visible: item.course.visible,
            summary: item.course.summary,
            startdate: item.course.startdate,
            enddate: item.course.enddate,
            course: item.course,
            group: item.group
          }))
        }
      } catch (courseError) {
        console.error('❌ Error obteniendo cursos-grupos, usando fallback legacy:', courseError)
        // Fallback completo al método legacy
        try {
          const legacyCourses = await sessionClient.getTeacherCourses()
          courses = legacyCourses.map(course => ({
            id: `${course.id}|0`, // Formato fallback sin grupos
            name: `${course.name || course.fullname} | Sin Grupos (Error)`,
            shortname: course.shortname,
            fullname: course.fullname,
            courseId: course.id.toString(),
            groupId: '0',
            courseName: course.name || course.fullname,
            groupName: 'Sin Grupos (Error)',
            visible: course.visible,
            summary: course.summary,
            startdate: course.startdate,
            enddate: course.enddate,
            course: course,
            group: null
          }))
        } catch (legacyError) {
          console.error('❌ Error también en fallback legacy:', legacyError)
          error = 'Error obteniendo cursos. Por favor, intente más tarde.'
          connectionStatus = 'error'
        }
      }
      
      console.log('📚 COMBINACIONES CURSO-GRUPO DONDE SOY PROFESOR:')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log(`📊 Total de combinaciones encontradas: ${courses.length}`)
      
      courses.forEach((item, index) => {
        console.log(`\n📖 COMBINACIÓN ${index + 1}:`)
        console.log(`   🆔 ID Combinado: ${item.id}`)
        console.log(`   📋 Display: ${item.name}`)
        console.log(`   🏫 Curso ID: ${item.courseId}`)
        console.log(`   👥 Grupo ID: ${item.groupId}`)
        console.log(`   📖 Curso: ${item.courseName}`)
        console.log(`   🎯 Grupo: ${item.groupName}`)
        console.log(`   👁️ Visible: ${item.visible ? 'Sí' : 'No'}`)
        
        // Mostrar información adicional si está disponible
        if (item.summary) {
          console.log(`   📝 Descripción: ${item.summary.substring(0, 100)}${item.summary.length > 100 ? '...' : ''}`)
        }
        
        if (item.startdate) {
          const startDate = new Date(item.startdate * 1000)
          console.log(`   📅 Fecha inicio: ${startDate.toLocaleDateString()}`)
        }
        
        if (item.enddate && item.enddate > 0) {
          const endDate = new Date(item.enddate * 1000)
          console.log(`   📅 Fecha fin: ${endDate.toLocaleDateString()}`)
        }
      })
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    } else {
      error = 'Token de sesión inválido o expirado.'
    }

  } catch (err: any) {
    console.error('❌ Error cargando dashboard:', err)
    error = err.message || 'Error desconocido al cargar datos'
    connectionStatus = 'error'
  }

  return (
    <IntelligentDashboardContent
      user={{
        id: session.user.id,
        name: session.user.name || '',
        firstName: session.user.name?.split(' ')[0] || '',
        matricula: session.user.matricula || ''
      }}
      courses={courses}
      connectionStatus={connectionStatus}
      error={error}
    />
  )
}
