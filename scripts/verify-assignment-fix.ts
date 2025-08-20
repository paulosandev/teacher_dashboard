// Script para verificar que la corrección de submissions funciona
import * as dotenv from 'dotenv'
dotenv.config()

async function verifyAssignmentFix() {
  console.log('🔧 VERIFICANDO CORRECCIÓN DE SUBMISSIONS')
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
    console.log(`🆔 Professor User ID: ${authResult.user.id}`)
    
    const client = new MoodleAPIClient(process.env.MOODLE_URL!, authResult.token!)
    
    // Simular la lógica del endpoint
    const assignments = await client.callMoodleAPI('mod_assign_get_assignments', {
      courseids: [courseId]
    })
    
    if (assignments && assignments.courses && assignments.courses.length > 0) {
      const courseAssignments = assignments.courses[0].assignments || []
      
      const targetAssignment = courseAssignments.find(a => 
        a.name === 'Modalidad de actividades | Semana 1'
      )
      
      if (targetAssignment) {
        console.log('\n🎯 === PROBANDO CORRECCIÓN ===')
        console.log(`📄 Asignación: ${targetAssignment.name}`)
        
        const submissions = await client.callMoodleAPI('mod_assign_get_submissions', {
          assignmentids: [targetAssignment.id]
        })
        
        if (submissions && submissions.assignments && submissions.assignments.length > 0) {
          const allSubmissions = submissions.assignments[0].submissions || []
          
          console.log(`📊 Total submissions (incluyendo profesor): ${allSubmissions.length}`)
          
          // Aplicar el filtro igual que en el endpoint
          const studentSubmissions = allSubmissions.filter(s => s.userid !== authResult.user.id)
          const submissionCount = studentSubmissions.length
          
          console.log(`📊 Submissions de estudiantes (filtradas): ${submissionCount}`)
          
          console.log('\n👥 === DETALLES DE SUBMISSIONS ===')
          allSubmissions.forEach((submission, index) => {
            const isTeacher = submission.userid === authResult.user.id
            console.log(`${index + 1}. User ID: ${submission.userid} ${isTeacher ? '(PROFESOR - FILTRADO)' : '(ESTUDIANTE)'}`)
            console.log(`   Estado: ${submission.status}`)
            console.log(`   Calificación: ${submission.gradingstatus}`)
          })
          
          console.log('\n✅ === RESULTADO ===')
          console.log(`🎯 Submissions que se mostrarán en la card: ${submissionCount}`)
          console.log(`📊 Esto coincide con Moodle web: ${submissionCount === 0 ? 'SÍ ✅' : 'NO ❌'}`)
          
        } else {
          console.log('✅ No hay submissions - perfecto, coincide con Moodle web')
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error durante la verificación:', error)
  }
}

verifyAssignmentFix().catch(console.error)