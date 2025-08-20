// Script para investigar la discrepancia en las entregas de asignaciones
import * as dotenv from 'dotenv'
dotenv.config()

async function investigateAssignmentDiscrepancy() {
  console.log('🔍 INVESTIGANDO DISCREPANCIA EN ASIGNACIONES')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const { getMoodleAuthService } = await import('../lib/auth/moodle-auth-service')
  const { MoodleAPIClient } = await import('../lib/moodle/api-client')
  
  const username = 'julioprofe'
  const password = 'admin1234'
  const courseId = 232
  
  try {
    console.log(`🔐 Autenticando usuario: ${username}`)
    
    const moodleAuthService = getMoodleAuthService()
    const authResult = await moodleAuthService.authenticateUser(username, password)
    
    if (!authResult.success || !authResult.user) {
      console.log('❌ Error de autenticación:', authResult.error)
      return
    }
    
    console.log('✅ Autenticación exitosa')
    console.log(`👤 Usuario: ${authResult.user.fullname}`)
    console.log(`🆔 User ID: ${authResult.user.id}`)
    
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, authResult.token!)
    
    console.log('\n📝 === INVESTIGANDO ASIGNACIONES ===')
    
    // Obtener todas las asignaciones del curso
    const assignments = await client.callMoodleAPI('mod_assign_get_assignments', {
      courseids: [courseId]
    })
    
    console.log('📄 Respuesta completa de asignaciones:')
    console.log(JSON.stringify(assignments, null, 2))
    
    if (assignments && assignments.courses && assignments.courses.length > 0) {
      const courseAssignments = assignments.courses[0].assignments || []
      
      // Buscar la asignación específica "Modalidad de actividades | Semana 1"
      const targetAssignment = courseAssignments.find(a => 
        a.name === 'Modalidad de actividades | Semana 1'
      )
      
      if (targetAssignment) {
        console.log('\n🎯 === ASIGNACIÓN ESPECÍFICA ENCONTRADA ===')
        console.log('📋 Datos completos de la asignación:')
        console.log(JSON.stringify(targetAssignment, null, 2))
        
        console.log('\n📥 === OBTENIENDO SUBMISSIONS ===')
        
        // Obtener submissions de esta asignación específica
        const submissions = await client.callMoodleAPI('mod_assign_get_submissions', {
          assignmentids: [targetAssignment.id]
        })
        
        console.log('📦 Respuesta completa de submissions:')
        console.log(JSON.stringify(submissions, null, 2))
        
        if (submissions && submissions.assignments && submissions.assignments.length > 0) {
          const assignmentSubmissions = submissions.assignments[0].submissions || []
          
          console.log('\n📊 === ANÁLISIS DE SUBMISSIONS ===')
          console.log(`📈 Total de submissions encontradas: ${assignmentSubmissions.length}`)
          
          assignmentSubmissions.forEach((submission, index) => {
            console.log(`\n📄 Submission ${index + 1}:`)
            console.log(`   👤 User ID: ${submission.userid}`)
            console.log(`   📅 Última modificación: ${new Date(submission.timemodified * 1000).toISOString()}`)
            console.log(`   ✅ Estado: ${submission.status}`)
            console.log(`   📊 Estado calificación: ${submission.gradingstatus}`)
            console.log(`   🔢 Intento: ${submission.attemptnumber}`)
            console.log(`   📋 Datos completos:`, JSON.stringify(submission, null, 2))
          })
        } else {
          console.log('❌ No se encontraron submissions en la respuesta')
        }
        
        console.log('\n🔍 === INTENTANDO DIFERENTES MÉTODOS ===')
        
        // Intentar obtener usuarios enrolados para comparar
        try {
          const enrolledUsers = await client.callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: courseId
          })
          
          console.log(`👥 Usuarios enrolados en el curso: ${enrolledUsers.length}`)
          enrolledUsers.forEach(user => {
            console.log(`   👤 ${user.fullname} (ID: ${user.id}) - Roles: ${user.roles?.map(r => r.name).join(', ') || 'Sin roles'}`)
          })
        } catch (error) {
          console.log('❌ Error obteniendo usuarios enrolados:', error)
        }
        
        // Intentar obtener grades
        try {
          const grades = await client.callMoodleAPI('core_grades_get_grades', {
            courseid: courseId,
            component: 'mod_assign',
            activityid: targetAssignment.cmid
          })
          
          console.log('\n📊 === CALIFICACIONES ===')
          console.log('📈 Respuesta de calificaciones:')
          console.log(JSON.stringify(grades, null, 2))
        } catch (error) {
          console.log('❌ Error obteniendo calificaciones:', error)
        }
        
      } else {
        console.log('❌ No se encontró la asignación "Modalidad de actividades | Semana 1"')
        console.log('📋 Asignaciones disponibles:')
        courseAssignments.forEach((assignment, index) => {
          console.log(`${index + 1}. ${assignment.name} (ID: ${assignment.id})`)
        })
      }
    }
    
  } catch (error) {
    console.error('❌ Error durante la investigación:', error)
  }
}

investigateAssignmentDiscrepancy().catch(console.error)