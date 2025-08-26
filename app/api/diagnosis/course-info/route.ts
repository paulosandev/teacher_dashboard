import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSmartMoodleClient } from '@/lib/moodle/smart-client'

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

    const { courseId, groupId, userMatricula } = await request.json()

    console.log('\n🔍 =================== DIAGNÓSTICO DE CURSO ===================')
    console.log(`Usuario: ${session.user.name}`)
    console.log(`Email: ${session.user.email}`)
    console.log(`Matrícula: ${userMatricula}`)
    console.log(`Curso ID: ${courseId}`)
    console.log(`Grupo ID: ${groupId}`)

    if (!courseId || !groupId || !userMatricula) {
      return NextResponse.json({ 
        error: 'Faltan parámetros requeridos',
        received: { courseId, groupId, userMatricula }
      }, { status: 400 })
    }

    // Crear cliente inteligente
    const smartClient = createSmartMoodleClient(session.user.id, userMatricula)
    
    const diagnosticData: any = {
      session: {
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        userMatricula: userMatricula
      },
      request: {
        courseId,
        groupId
      },
      tests: {}
    }

    // Test 1: Verificar conexión
    console.log('\n🧪 Test 1: Verificando conexión...')
    try {
      const isConnected = await smartClient.testConnection()
      diagnosticData.tests.connection = {
        status: isConnected ? 'success' : 'failed',
        result: isConnected
      }
      console.log(`   Resultado: ${isConnected ? '✅ Conectado' : '❌ Sin conexión'}`)
    } catch (error) {
      diagnosticData.tests.connection = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 2: Obtener información del usuario
    console.log('\n🧪 Test 2: Obteniendo información del usuario...')
    try {
      const userInfo = await smartClient.getUserInfo()
      diagnosticData.tests.userInfo = {
        status: 'success',
        result: userInfo
      }
      console.log(`   Resultado: Usuario encontrado - ID: ${userInfo?.id}`)
    } catch (error) {
      diagnosticData.tests.userInfo = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 3: Obtener lista de cursos del profesor
    console.log('\n🧪 Test 3: Obteniendo cursos del profesor...')
    try {
      const courses = await smartClient.getTeacherCourses()
      diagnosticData.tests.teacherCourses = {
        status: 'success',
        count: courses?.length || 0,
        result: courses?.slice(0, 3) || [] // Solo primeros 3 para no sobrecargar
      }
      console.log(`   Resultado: ${courses?.length || 0} cursos encontrados`)
      
      // Verificar si el curso seleccionado está en la lista
      const selectedCourse = courses?.find((course: any) => course.id.toString() === courseId.toString())
      diagnosticData.tests.selectedCourseFound = {
        status: selectedCourse ? 'success' : 'failed',
        result: selectedCourse || null
      }
      console.log(`   Curso seleccionado encontrado: ${selectedCourse ? '✅ Sí' : '❌ No'}`)
    } catch (error) {
      diagnosticData.tests.teacherCourses = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 4: Obtener contenido del curso
    console.log('\n🧪 Test 4: Obteniendo contenido del curso...')
    try {
      const courseContents = await smartClient.getCourseContents(courseId)
      diagnosticData.tests.courseContents = {
        status: 'success',
        sectionsCount: courseContents?.length || 0,
        result: courseContents?.slice(0, 2) || [] // Solo primeras 2 secciones
      }
      console.log(`   Resultado: ${courseContents?.length || 0} secciones encontradas`)
    } catch (error) {
      diagnosticData.tests.courseContents = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 5: Obtener grupos del curso
    console.log('\n🧪 Test 5: Obteniendo grupos del curso...')
    try {
      const courseGroups = await smartClient.getCourseGroups(courseId)
      diagnosticData.tests.courseGroups = {
        status: 'success',
        count: courseGroups?.length || 0,
        result: courseGroups || []
      }
      console.log(`   Resultado: ${courseGroups?.length || 0} grupos encontrados`)
      
      // Verificar si el grupo seleccionado está en la lista
      const selectedGroup = courseGroups?.find((group: any) => group.id.toString() === groupId.toString())
      diagnosticData.tests.selectedGroupFound = {
        status: selectedGroup ? 'success' : 'failed',
        result: selectedGroup || null
      }
      console.log(`   Grupo seleccionado encontrado: ${selectedGroup ? '✅ Sí' : '❌ No'}`)
    } catch (error) {
      diagnosticData.tests.courseGroups = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 6: Obtener foros del curso
    console.log('\n🧪 Test 6: Obteniendo foros del curso...')
    try {
      const forums = await smartClient.getCourseForums(courseId)
      diagnosticData.tests.forums = {
        status: 'success',
        count: forums?.length || 0,
        result: forums?.slice(0, 2) || [] // Solo primeros 2
      }
      console.log(`   Resultado: ${forums?.length || 0} foros encontrados`)
    } catch (error) {
      diagnosticData.tests.forums = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 7: Obtener tareas del curso (general y de secciones)
    console.log('\n🧪 Test 7: Obteniendo tareas del curso...')
    try {
      // Primero obtener tareas generales del curso
      const assignments = await smartClient.getCourseAssignments(courseId)
      const generalAssignments = assignments?.courses?.[0]?.assignments || []
      
      // Luego obtener tareas de las secciones del curso
      const courseContents = await smartClient.getCourseContents(courseId)
      const sectionAssignments: any[] = []
      const assignmentIds = new Set<number>() // Para evitar duplicados
      
      // Primero agregar IDs de tareas generales
      generalAssignments.forEach((a: any) => assignmentIds.add(a.id))
      
      // Extraer tareas de cada sección (sin duplicar)
      if (courseContents && Array.isArray(courseContents)) {
        for (const section of courseContents) {
          if (section.modules && Array.isArray(section.modules)) {
            for (const module of section.modules) {
              // Buscar módulos de tipo 'assign' (tareas)
              if (module.modname === 'assign' && !assignmentIds.has(module.instance)) {
                sectionAssignments.push({
                  id: module.instance,
                  cmid: module.id,
                  name: module.name,
                  sectionName: section.name,
                  sectionId: section.id,
                  url: module.url,
                  visible: module.visible,
                  availability: module.availability
                })
                assignmentIds.add(module.instance)
              }
            }
          }
        }
      }
      
      // Crear mapa detallado de todas las tareas
      const assignmentMap = new Map<number, any>()
      
      // Agregar tareas del API general con detalles completos
      generalAssignments.forEach((a: any) => {
        assignmentMap.set(a.id, {
          id: a.id,
          cmid: a.cmid,
          name: a.name,
          duedate: a.duedate,
          allowsubmissionsfromdate: a.allowsubmissionsfromdate,
          grade: a.grade,
          source: 'api',
          visible: true
        })
      })
      
      // Enriquecer con información de secciones
      if (courseContents && Array.isArray(courseContents)) {
        for (const section of courseContents) {
          if (section.modules && Array.isArray(section.modules)) {
            for (const module of section.modules) {
              if (module.modname === 'assign') {
                const existing = assignmentMap.get(module.instance)
                if (existing) {
                  // Enriquecer con información de la sección
                  existing.sectionName = section.name
                  existing.sectionId = section.id
                  existing.url = module.url
                  existing.visible = module.visible
                  existing.availability = module.availability
                } else {
                  // Tarea solo encontrada en sección (no en API general)
                  assignmentMap.set(module.instance, {
                    id: module.instance,
                    cmid: module.id,
                    name: module.name,
                    sectionName: section.name,
                    sectionId: section.id,
                    url: module.url,
                    visible: module.visible,
                    availability: module.availability,
                    source: 'section-only'
                  })
                }
              }
            }
          }
        }
      }
      
      // Convertir mapa a array y ordenar por sección
      const allAssignments = Array.from(assignmentMap.values())
        .sort((a, b) => (a.sectionId || 0) - (b.sectionId || 0))
      
      // Contar tareas por sección
      const assignmentsBySction: { [key: string]: number } = {}
      allAssignments.forEach(a => {
        const section = a.sectionName || 'Sin sección'
        assignmentsBySction[section] = (assignmentsBySction[section] || 0) + 1
      })
      
      diagnosticData.tests.assignments = {
        status: 'success',
        totalCount: allAssignments.length,
        bySection: assignmentsBySction,
        result: allAssignments.slice(0, 10) // Primeras 10 tareas
      }
      
      console.log(`   Resultado:`)
      console.log(`   - Total tareas únicas: ${allAssignments.length}`)
      console.log(`\n   📚 Distribución por sección:`)
      Object.entries(assignmentsBySction).forEach(([section, count]) => {
        console.log(`      - ${section}: ${count} tarea(s)`)
      })
      
      // Mostrar algunas tareas con detalles
      if (allAssignments.length > 0) {
        console.log(`\n   📋 Primeras tareas encontradas:`)
        allAssignments.slice(0, 5).forEach((task: any) => {
          const dueInfo = task.duedate ? new Date(task.duedate * 1000).toLocaleDateString() : 'Sin fecha límite'
          console.log(`      - "${task.name}" (${task.sectionName || 'General'}) - ${dueInfo}`)
        })
      }
    } catch (error) {
      diagnosticData.tests.assignments = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    // Test 8: Obtener participación de estudiantes
    console.log('\n🧪 Test 8: Obteniendo participación de estudiantes...')
    try {
      const participation = await smartClient.getStudentParticipation(courseId, groupId)
      diagnosticData.tests.studentParticipation = {
        status: participation ? 'success' : 'failed',
        result: participation || null
      }
      console.log(`   Resultado: ${participation ? '✅ Datos de participación obtenidos' : '❌ Sin datos de participación'}`)
      if (participation) {
        console.log(`   - Total estudiantes: ${participation.totalStudents}`)
        console.log(`   - Foros analizados: ${participation.forums.details.length}`)
        console.log(`   - Tareas analizadas: ${participation.assignments.details.length}`)
      }
    } catch (error) {
      diagnosticData.tests.studentParticipation = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }
      console.log(`   Error: ${error}`)
    }

    console.log('\n📊 =================== RESUMEN DE DIAGNÓSTICO ===================')
    const successfulTests = Object.values(diagnosticData.tests).filter((test: any) => test.status === 'success').length
    const totalTests = Object.keys(diagnosticData.tests).length
    
    console.log(`Tests exitosos: ${successfulTests}/${totalTests}`)
    console.log('================================================================\n')

    return NextResponse.json({
      success: true,
      message: `Diagnóstico completado: ${successfulTests}/${totalTests} tests exitosos`,
      data: diagnosticData,
      summary: {
        successfulTests,
        totalTests,
        allTestsPassed: successfulTests === totalTests
      }
    })

  } catch (error: any) {
    console.error('❌ Error en diagnóstico:', error)
    
    return NextResponse.json({
      error: 'Error en diagnóstico',
      details: error instanceof Error ? error.message : 'Error desconocido',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
