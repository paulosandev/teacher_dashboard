import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSessionMoodleClient } from '@/lib/moodle/session-client'
import { getMoodleAuthService } from '@/lib/auth/moodle-auth-service'
import { MoodleAPIClient } from '@/lib/moodle/api-client'
import fs from 'fs'
import path from 'path'

// Forzar runtime dinámico para evitar errores en build
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const reportId = `debug-course-${timestamp}`
  
  try {
    // Verificar autenticación
    const session = await getServerSession(authOptions)
    if (!session?.user?.moodleToken) {
      return NextResponse.json({ error: 'No autorizado - sesión requerida' }, { status: 401 })
    }

    const { courseGroupId } = await request.json()
    
    if (!courseGroupId) {
      return NextResponse.json({ 
        error: 'courseGroupId es requerido (formato: courseId|groupId)' 
      }, { status: 400 })
    }

    // Parsear courseId y groupId
    const [courseId, groupId] = courseGroupId.split('|')
    
    console.log(`🐛 [${reportId}] Iniciando reporte de debug...`)
    console.log(`   Usuario: ${session.user.name} (${session.user.matricula})`)
    console.log(`   Curso: ${courseId}`)
    console.log(`   Grupo: ${groupId}`)

    // Crear cliente de sesión
    const sessionClient = createSessionMoodleClient(true) // server-side
    const authService = getMoodleAuthService()

    // Inicializar reporte
    let debugReport = `
========================================
REPORTE DE DEBUG DEL CURSO
========================================

📊 INFORMACIÓN GENERAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• ID de Reporte: ${reportId}
• Fecha y Hora: ${new Date().toLocaleString()}
• Usuario: ${session.user.name} (ID: ${session.user.id})
• Matrícula: ${session.user.matricula}
• Curso ID: ${courseId}
• Grupo ID: ${groupId}
• Token válido hasta: ${session.user.tokenExpiry}

🔐 INFORMACIÓN DE AUTENTICACIÓN DEL PROFESOR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• API Key/Token de Moodle: ${session.user.moodleToken ? session.user.moodleToken.substring(0, 20) + '...' : 'No disponible'}
• Token completo (para debug): ${session.user.moodleToken || 'No disponible'}
• Longitud del token: ${session.user.moodleToken ? session.user.moodleToken.length : 0} caracteres
• Tipo de autenticación: ${session.user.moodleToken ? 'Token Moodle directo' : 'Sin autenticación'}
• Email del profesor: ${session.user.email || 'No disponible'}

`

    // 1. VERIFICAR CONEXIÓN
    debugReport += `🔌 VERIFICACIÓN DE CONEXIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    
    const isConnected = await sessionClient.testConnection()
    debugReport += `• Estado de conexión: ${isConnected ? '✅ CONECTADO' : '❌ DESCONECTADO'}\n`
    
    if (!isConnected) {
      debugReport += `• ERROR: No se pudo conectar con Moodle\n`
      await saveDebugReport(reportId, debugReport)
      return NextResponse.json({ 
        error: 'No se pudo conectar con Moodle',
        reportPath: `ReportDebug/${reportId}.txt`
      }, { status: 503 })
    }

    // 2. OBTENER CURSOS DEL PROFESOR - ALGORITMO OPTIMIZADO
    debugReport += `\n📚 CURSOS DEL PROFESOR - ALGORITMO OPTIMIZADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 IMPLEMENTACIÓN DEL PSEUDO-CÓDIGO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ID del profesor que queremos consultar
profesor_id = ${session.user.id};

// Paso 1: Obtener sus cursos
lista_de_cursos = llamar_api('core_enrol_get_users_courses', {userid: profesor_id});

// Array para guardar todos los grupos encontrados
todos_los_ids_de_grupos = [];

// Paso 2: Recorrer los cursos para obtener sus grupos
para cada curso en lista_de_cursos {
  grupos_del_curso = llamar_api('core_group_get_course_groups', {courseid: curso.id});
  para cada grupo en grupos_del_curso {
    agregar grupo.id a todos_los_ids_de_grupos;
  }
}

// Paso 3: Consultar los miembros de todos esos grupos de una sola vez
grupos_con_miembros = llamar_api('core_group_get_group_members', {groupids: todos_los_ids_de_grupos});

// Array final para guardar los grupos del profesor
grupos_finales_del_profesor = [];

// Filtrar el resultado
para cada grupo en grupos_con_miembros {
  si profesor_id está en la lista grupo.userids {
    agregar grupo a grupos_finales_del_profesor;
  }
}

🎯 RESULTADO DE LA EJECUCIÓN:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`
    
    try {
      const teacherCourseGroups = await authService.getTeacherCourseGroups(
        session.user.moodleToken, 
        parseInt(session.user.id)
      )
      
      debugReport += `• Total de combinaciones curso-grupo encontradas: ${teacherCourseGroups.length}\n\n`
      
      if (teacherCourseGroups.length > 0) {
        debugReport += `📋 LISTADO DE COMBINACIONES:\n`
        teacherCourseGroups.forEach((item, index) => {
          debugReport += `${index + 1}. ${item.displayName}\n`
          debugReport += `   - Curso ID: ${item.courseId}\n`
          debugReport += `   - Grupo ID: ${item.groupId}\n`
          debugReport += `   - Curso: ${item.courseName}\n`
          debugReport += `   - Grupo: ${item.groupName}\n`
          debugReport += `   - Tipo: ${item.groupId === '0' ? 'Acceso General' : 'Grupo Específico'}\n\n`
        })
      } else {
        debugReport += `❌ No se encontraron combinaciones curso-grupo para el usuario.\n`
        debugReport += `   Esto puede indicar:\n`
        debugReport += `   - El usuario no es profesor en ningún curso\n`
        debugReport += `   - El usuario es profesor pero no está enrolado en grupos específicos\n`
        debugReport += `   - Errores de permisos en la API de Moodle\n\n`
      }
      
    } catch (error: any) {
      debugReport += `❌ ERROR obteniendo cursos con algoritmo optimizado: ${error.message}\n`
      debugReport += `📋 Stack trace: ${error.stack}\n\n`
    }

    // 3. INFORMACIÓN DETALLADA DEL CURSO SELECCIONADO
    debugReport += `\n🔍 INFORMACIÓN DETALLADA DEL CURSO SELECCIONADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Curso ID: ${courseId}
• Grupo ID: ${groupId}

`

    // 3.1 Información básica del curso
    try {
      const courseInfo = await sessionClient.getCourseInfo(courseId)
      debugReport += `📋 INFORMACIÓN BÁSICA DEL CURSO:\n`
      debugReport += `• Nombre: ${courseInfo?.fullname || 'No disponible'}\n`
      debugReport += `• Nombre corto: ${courseInfo?.shortname || 'No disponible'}\n`
      debugReport += `• ID: ${courseInfo?.id || courseId}\n`
      debugReport += `• Visible: ${courseInfo?.visible ? 'Sí' : 'No'}\n`
      debugReport += `• Fecha inicio: ${courseInfo?.startdate ? new Date(courseInfo.startdate * 1000).toLocaleDateString() : 'No disponible'}\n`
      debugReport += `• Fecha fin: ${courseInfo?.enddate ? new Date(courseInfo.enddate * 1000).toLocaleDateString() : 'No disponible'}\n\n`
    } catch (error: any) {
      debugReport += `• ERROR obteniendo información básica: ${error.message}\n\n`
    }

    // 3.2 Grupos del curso
    try {
      const courseGroups = await sessionClient.getCourseGroups(courseId)
      debugReport += `👥 GRUPOS DEL CURSO:\n`
      debugReport += `• Total de grupos: ${courseGroups?.length || 0}\n\n`
      
      if (courseGroups && courseGroups.length > 0) {
        for (let i = 0; i < courseGroups.length; i++) {
          const group = courseGroups[i]
          debugReport += `GRUPO ${i + 1}:\n`
          debugReport += `  • ID: ${group.id}\n`
          debugReport += `  • Nombre: ${group.name}\n`
          debugReport += `  • Descripción: ${group.description || 'Sin descripción'}\n`
          
          // Obtener miembros del grupo (con manejo silencioso de errores de permisos)
          try {
            const groupMembers = await sessionClient.getGroupMembers(group.id.toString(), courseId)
            debugReport += `  • Total miembros: ${groupMembers?.length || 0}\n`
            
            if (groupMembers && groupMembers.length > 0) {
              debugReport += `  • MIEMBROS:\n`
              groupMembers.forEach((member: any, memberIndex: number) => {
                debugReport += `    ${memberIndex + 1}. ${member.firstname} ${member.lastname}\n`
                debugReport += `       - User ID: ${member.id || member.userid}\n`
                debugReport += `       - Email: ${member.email || 'No disponible'}\n`
                debugReport += `       - Roles: ${member.roles?.map((r: any) => r.shortname).join(', ') || 'No disponible'}\n`
                
                // Verificar si es nuestro usuario
                const currentUserId = parseInt(session.user.id)
                const memberUserId = parseInt(member.id || member.userid)
                if (memberUserId === currentUserId) {
                  debugReport += `       - ⭐ ESTE ES EL USUARIO ACTUAL ⭐\n`
                }
                debugReport += `\n`
              })
            } else {
              debugReport += `  • Sin miembros\n`
            }
          } catch (error: any) {
            // Manejo silencioso para errores de permisos esperados
            if (error.message?.includes('Excepción al control de acceso')) {
              debugReport += `  • Sin permisos para ver miembros (privado)\n`
            } else {
              debugReport += `  • ERROR obteniendo miembros: ${error.message}\n`
            }
          }
          
          debugReport += `\n`
        }
      } else {
        debugReport += `• Este curso no tiene grupos configurados\n\n`
      }
    } catch (error: any) {
      debugReport += `• ERROR obteniendo grupos: ${error.message}\n\n`
    }

    // 3.3 Usuarios enrolados en el curso
    try {
      const enrolledUsers = await sessionClient.getEnrolledUsers(courseId)
      debugReport += `👤 USUARIOS ENROLADOS EN EL CURSO:\n`
      debugReport += `• Total de usuarios enrolados: ${enrolledUsers?.length || 0}\n\n`
      
      if (enrolledUsers && enrolledUsers.length > 0) {
        // Separar por roles
        const teachers = enrolledUsers.filter((user: any) => 
          user.roles?.some((role: any) => 
            role.roleid === 3 || role.roleid === 4 || 
            role.shortname?.includes('teacher')
          )
        )
        
        const students = enrolledUsers.filter((user: any) => 
          user.roles?.some((role: any) => role.roleid === 5)
        )
        
        debugReport += `📚 PROFESORES (${teachers.length}):\n`
        teachers.forEach((teacher: any, index: number) => {
          debugReport += `${index + 1}. ${teacher.firstname} ${teacher.lastname}\n`
          debugReport += `   - User ID: ${teacher.id}\n`
          debugReport += `   - Email: ${teacher.email}\n`
          debugReport += `   - Roles: ${teacher.roles?.map((r: any) => `${r.shortname} (ID: ${r.roleid})`).join(', ')}\n`
          
          // Verificar si es nuestro usuario
          const currentUserId = parseInt(session.user.id)
          if (parseInt(teacher.id) === currentUserId) {
            debugReport += `   - ⭐ ESTE ES EL USUARIO ACTUAL ⭐\n`
          }
          debugReport += `\n`
        })
        
        debugReport += `🎓 ESTUDIANTES (${students.length}):\n`
        students.forEach((student: any, index: number) => {
          debugReport += `${index + 1}. ${student.firstname} ${student.lastname}\n`
          debugReport += `   - User ID: ${student.id}\n`
          debugReport += `   - Email: ${student.email}\n`
          debugReport += `   - Último acceso: ${student.lastaccess ? new Date(student.lastaccess * 1000).toLocaleDateString() : 'Nunca'}\n`
          debugReport += `\n`
        })
      }
    } catch (error: any) {
      debugReport += `• ERROR obteniendo usuarios enrolados: ${error.message}\n\n`
    }

    // 3.4 Contenido del curso
    try {
      const courseContents = await sessionClient.getCourseContents(courseId)
      debugReport += `📖 CONTENIDO DEL CURSO:\n`
      debugReport += `• Total de secciones: ${courseContents?.length || 0}\n\n`
      
      if (courseContents && courseContents.length > 0) {
        courseContents.forEach((section: any, index: number) => {
          debugReport += `SECCIÓN ${index + 1}: ${section.name || `Sección ${section.section}`}\n`
          debugReport += `  • ID: ${section.id}\n`
          debugReport += `  • Visible: ${section.visible ? 'Sí' : 'No'}\n`
          debugReport += `  • Módulos: ${section.modules?.length || 0}\n`
          
          if (section.modules && section.modules.length > 0) {
            section.modules.forEach((module: any, moduleIndex: number) => {
              debugReport += `    ${moduleIndex + 1}. ${module.name} (${module.modname})\n`
              debugReport += `       - ID: ${module.id}\n`
              debugReport += `       - Instance: ${module.instance}\n`
              debugReport += `       - Visible: ${module.visible ? 'Sí' : 'No'}\n`
            })
          }
          debugReport += `\n`
        })
      }
    } catch (error: any) {
      debugReport += `• ERROR obteniendo contenido: ${error.message}\n\n`
    }

    // 4. ANÁLISIS ESPECÍFICO DEL PROBLEMA: GRUPO_01 DEL CURSO 229
    debugReport += `\n🔍 ANÁLISIS ESPECÍFICO DEL PROBLEMA DE DETECCIÓN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 PROBLEMA REPORTADO:
- En la interfaz web de Moodle (https://av141.utel.edu.mx/group/index.php?id=229)
- El profesor "Julio Profe" SÍ aparece en "Grupo_01" 
- Pero nuestro algoritmo NO lo detecta

📋 INVESTIGACIÓN DETALLADA:
• Usuario actual ID: ${session.user.id}
• Curso específico a investigar: 229 (Fundamentos de la educación_D)
• Grupo específico a investigar: Grupo_01 (según captura: 10 miembros)

`
    
    // Investigación específica del Grupo_01 en curso 229
    if (courseId === '229') {
      try {
        debugReport += `🔍 INVESTIGACIÓN ESPECÍFICA - CURSO 229:\n`
        
        // Primero obtener todos los grupos del curso 229
        const courseGroups = await sessionClient.getCourseGroups('229')
        debugReport += `• Total grupos en curso 229: ${courseGroups?.length || 0}\n\n`
        
        // Buscar específicamente el Grupo_01
        const grupo01 = courseGroups?.find((g: any) => g.name === 'Grupo_01')
        if (grupo01) {
          debugReport += `✅ GRUPO_01 ENCONTRADO:\n`
          debugReport += `• ID del grupo: ${grupo01.id}\n`
          debugReport += `• Nombre: ${grupo01.name}\n`
          debugReport += `• Descripción: ${grupo01.description || 'Sin descripción'}\n\n`
          
          // Ahora probar diferentes métodos para obtener miembros
          debugReport += `🧪 PROBANDO DIFERENTES MÉTODOS DE API:\n\n`
          
          // Método 1: getGroupMembers (nuestro método actual)
          try {
            const members1 = await sessionClient.getGroupMembers(grupo01.id.toString(), '229')
            debugReport += `📋 MÉTODO 1 - getGroupMembers(${grupo01.id}):\n`
            debugReport += `• Total miembros: ${members1?.length || 0}\n`
            
            if (members1 && members1.length > 0) {
              debugReport += `• Lista de miembros:\n`
              members1.forEach((member: any, index: number) => {
                const memberUserId = parseInt(member.id || member.userid)
                const isCurrentUser = memberUserId === parseInt(session.user.id)
                debugReport += `  ${index + 1}. ${member.firstname} ${member.lastname} (ID: ${memberUserId})\n`
                debugReport += `     - Email: ${member.email}\n`
                debugReport += `     - Roles: ${member.roles?.map((r: any) => r.shortname).join(', ') || 'No disponible'}\n`
                debugReport += `     - Es profesor actual: ${isCurrentUser ? '✅ SÍ' : '❌ NO'}\n`
              })
            } else {
              debugReport += `• ❌ Sin miembros o error\n`
            }
          } catch (error: any) {
            debugReport += `❌ MÉTODO 1 ERROR: ${error.message}\n`
          }
          
          debugReport += `\n`
          
          // Método 2: Llamada directa a la API
          try {
            const client = new MoodleAPIClient(process.env.MOODLE_URL!, session.user.moodleToken)
            const members2 = await client.callMoodleAPI('core_group_get_group_members', {
              groupids: [grupo01.id]
            })
            
            debugReport += `📋 MÉTODO 2 - API directa core_group_get_group_members([${grupo01.id}]):\n`
            debugReport += `• Respuesta completa: ${JSON.stringify(members2, null, 2)}\n`
            
            if (members2 && Array.isArray(members2) && members2.length > 0) {
              debugReport += `• Total grupos en respuesta: ${members2.length}\n`
              members2.forEach((groupData: any, groupIndex: number) => {
                debugReport += `  Grupo ${groupIndex + 1}:\n`
                debugReport += `    - Group ID: ${groupData.groupid}\n`
                debugReport += `    - User IDs: [${groupData.userids?.join(', ') || 'ninguno'}]\n`
                debugReport += `    - ¿Incluye profesor ID ${session.user.id}?: ${groupData.userids?.includes(parseInt(session.user.id)) ? '✅ SÍ' : '❌ NO'}\n`
              })
            } else {
              debugReport += `• ❌ Sin datos o formato inesperado\n`
            }
          } catch (error: any) {
            debugReport += `❌ MÉTODO 2 ERROR: ${error.message}\n`
          }
          
          debugReport += `\n`
          
          // Método 3: Verificar desde usuarios enrolados del curso
          try {
            const enrolledUsers = await sessionClient.getEnrolledUsers('229')
            const currentUser = enrolledUsers?.find((u: any) => u.id === parseInt(session.user.id))
            
            debugReport += `📋 MÉTODO 3 - Verificar desde usuarios enrolados:\n`
            debugReport += `• Usuario actual en curso: ${currentUser ? '✅ Encontrado' : '❌ No encontrado'}\n`
            
            if (currentUser) {
              debugReport += `• Datos del usuario:\n`
              debugReport += `  - ID: ${currentUser.id}\n`
              debugReport += `  - Nombre: ${currentUser.firstname} ${currentUser.lastname}\n`
              debugReport += `  - Email: ${currentUser.email}\n`
              debugReport += `  - Roles: ${currentUser.roles?.map((r: any) => `${r.shortname} (${r.roleid})`).join(', ') || 'No disponible'}\n`
              debugReport += `  - Groups: ${currentUser.groups?.length ? currentUser.groups.map((g: any) => `${g.name} (${g.id})`).join(', ') : 'No disponible directamente'}\n`
            }
          } catch (error: any) {
            debugReport += `❌ MÉTODO 3 ERROR: ${error.message}\n`
          }
          
        } else {
          debugReport += `❌ GRUPO_01 NO ENCONTRADO en la lista de grupos del curso\n`
          
          debugReport += `📋 Grupos disponibles en curso 229:\n`
          courseGroups?.forEach((group: any, index: number) => {
            debugReport += `${index + 1}. ${group.name} (ID: ${group.id})\n`
          })
        }
        
      } catch (error: any) {
        debugReport += `❌ ERROR en investigación específica: ${error.message}\n`
      }
    } else {
      debugReport += `ℹ️ CURSO SELECCIONADO: ${courseId} (No es el curso 229 del problema reportado)\n`
    }
    
    // Análisis estándar para el curso/grupo actual
    debugReport += `\n🔍 ANÁLISIS ESTÁNDAR DEL CURSO/GRUPO SELECCIONADO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Curso seleccionado ID: ${courseId}
• Grupo seleccionado ID: ${groupId}
`
    
    if (groupId !== '0') {
      try {
        const groupMembers = await sessionClient.getGroupMembers(groupId, courseId)
        const currentUserId = parseInt(session.user.id)
        
        debugReport += `📋 MIEMBROS DEL GRUPO ${groupId}:\n`
        debugReport += `• Total de miembros: ${groupMembers?.length || 0}\n\n`
        
        let userFoundInGroup = false
        
        if (groupMembers && groupMembers.length > 0) {
          groupMembers.forEach((member: any, index: number) => {
            const memberUserId = parseInt(member.id || member.userid)
            const isCurrentUser = memberUserId === currentUserId
            
            debugReport += `${index + 1}. ${member.firstname} ${member.lastname}\n`
            debugReport += `   - User ID: ${memberUserId}\n`
            debugReport += `   - Email: ${member.email}\n`
            debugReport += `   - Es usuario actual: ${isCurrentUser ? '✅ SÍ' : '❌ NO'}\n`
            
            if (isCurrentUser) {
              userFoundInGroup = true
              debugReport += `   - ⭐ ESTE ES EL USUARIO ACTUAL - ENCONTRADO EN EL GRUPO ⭐\n`
            }
            debugReport += `\n`
          })
        }
        
        debugReport += `🎯 RESULTADO DE VALIDACIÓN:\n`
        debugReport += `• Usuario ${session.user.id} encontrado en grupo ${groupId}: ${userFoundInGroup ? '✅ SÍ' : '❌ NO'}\n`
        debugReport += `• Debería tener acceso: ${userFoundInGroup ? '✅ SÍ' : '❌ NO'}\n\n`
        
      } catch (error: any) {
        debugReport += `• ERROR en validación de grupo: ${error.message}\n\n`
      }
    } else {
      debugReport += `• Grupo ID es '0' - Acceso general sin grupos específicos\n\n`
    }

    // Finalizar reporte
    debugReport += `\n🔚 FIN DEL REPORTE
Generado automáticamente por el Sistema de Debug del Dashboard UTEL
Timestamp: ${new Date().toISOString()}
`

    // Guardar reporte
    const reportPath = await saveDebugReport(reportId, debugReport)
    
    console.log(`✅ [${reportId}] Reporte de debug generado: ${reportPath}`)

    return NextResponse.json({
      success: true,
      reportId,
      reportPath: `ReportDebug/${reportId}.txt`,
      message: 'Reporte de debug generado exitosamente'
    })

  } catch (error: any) {
    console.error(`❌ Error en reporte de debug:`, error)
    
    const errorReport = `
ERROR EN REPORTE DE DEBUG
========================
ID de Reporte: ${reportId}
Fecha: ${new Date().toLocaleString()}
Error: ${error.message}
Stack: ${error.stack}
`
    
    await saveDebugReport(`${reportId}-ERROR`, errorReport)
    
    return NextResponse.json({
      error: 'Error generando reporte de debug',
      details: error.message,
      reportId
    }, { status: 500 })
  }
}

async function saveDebugReport(reportId: string, content: string) {
  try {
    const reportsDir = path.join(process.cwd(), 'ReportDebug')
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const fileName = `${reportId}.txt`
    const filePath = path.join(reportsDir, fileName)

    fs.writeFileSync(filePath, content, 'utf8')

    console.log(`📄 Reporte de debug guardado: ${filePath}`)
    return filePath

  } catch (error) {
    console.error('Error guardando reporte de debug:', error)
    return null
  }
}