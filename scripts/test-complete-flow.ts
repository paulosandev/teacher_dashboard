// Script para probar el flujo completo del nuevo sistema
import * as dotenv from 'dotenv'
dotenv.config()

async function testCompleteFlow() {
  // Cargar variables antes de importar servicios
  console.log('🔧 Variables de entorno:')
  console.log(`   MOODLE_URL: ${process.env.MOODLE_URL}`)

  // Importar después de cargar las variables
  const { moodleAuthService } = await import('../lib/auth/moodle-auth-service')
  const { createSessionMoodleClient } = await import('../lib/moodle/session-client')
  console.log('🧪 PROBANDO FLUJO COMPLETO DEL NUEVO SISTEMA')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const username = 'cesar.espindola'
  const password = 'admin1234'
  
  try {
    // 1. Probar autenticación directa
    console.log('\n🔐 PASO 1: Autenticación directa con Moodle')
    const authResult = await moodleAuthService.authenticateUser(username, password)
    
    if (!authResult.success) {
      console.log('❌ Error en autenticación:', authResult.error)
      return
    }
    
    console.log('✅ Autenticación exitosa:')
    console.log(`   Token: ${authResult.token?.substring(0, 20)}...`)
    console.log(`   Usuario: ${authResult.user?.name}`)
    console.log(`   Matrícula: ${authResult.user?.matricula}`)
    console.log(`   Es profesor: ${authResult.user?.isTeacher ? 'Sí' : 'No'}`)
    console.log(`   Expira: ${authResult.tokenExpiry}`)
    
    // 2. Simular sesión de NextAuth
    console.log('\n👤 PASO 2: Simulando sesión de NextAuth')
    const mockSession = {
      user: {
        name: authResult.user?.name,
        matricula: authResult.user?.matricula,
        moodleToken: authResult.token,
        tokenExpiry: authResult.tokenExpiry
      }
    }
    
    console.log('✅ Sesión simulada creada correctamente')
    
    // 3. Probar SessionMoodleClient
    console.log('\n🔌 PASO 3: Probando SessionMoodleClient')
    
    // Simular getSession para testing
    const originalGetSession = require('next-auth/react').getSession
    
    // Mock temporal
    require('next-auth/react').getSession = () => Promise.resolve(mockSession)
    
    const sessionClient = createSessionMoodleClient(false) // client-side
    
    const isConnected = await sessionClient.testConnection()
    console.log(`   Conexión: ${isConnected ? '✅ Exitosa' : '❌ Fallida'}`)
    
    if (isConnected) {
      console.log('\n📚 PASO 4: Obteniendo cursos del profesor')
      const courses = await sessionClient.getTeacherCourses()
      console.log(`   Cursos encontrados: ${courses.length}`)
      
      for (const course of courses.slice(0, 2)) {
        console.log(`   📖 ${course.name} (ID: ${course.id})`)
        if (course.groups?.length > 0) {
          console.log(`      Grupos: ${course.groups.map((g: any) => g.name).join(', ')}`)
        }
      }
      
      // 5. Probar análisis course-based
      if (courses.length > 0) {
        const firstCourse = courses[0]
        const firstGroup = firstCourse.groups?.[0]
        
        if (firstGroup) {
          console.log('\n🤖 PASO 5: Probando análisis course-based')
          console.log(`   Curso: ${firstCourse.name}`)
          console.log(`   Grupo: ${firstGroup.name}`)
          
          try {
            const response = await fetch('http://localhost:3001/api/analysis/generate-course-analysis', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authResult.token}`
              },
              body: JSON.stringify({
                courseId: firstCourse.id,
                groupId: firstGroup.id
              })
            })
            
            if (response.ok) {
              const result = await response.json()
              console.log('✅ Análisis generado exitosamente')
              console.log(`   Request ID: ${result.details?.requestId}`)
              console.log(`   Tiempo: ${result.details?.processingTime}ms`)
            } else {
              console.log('❌ Error generando análisis:', await response.text())
            }
          } catch (error) {
            console.log('❌ Error en análisis:', error)
          }
        }
      }
    }
    
    // Restaurar función original
    require('next-auth/react').getSession = originalGetSession
    
    console.log('\n🎉 FLUJO COMPLETO PROBADO EXITOSAMENTE')
    
  } catch (error) {
    console.error('❌ ERROR EN FLUJO COMPLETO:', error)
  }
}

testCompleteFlow().catch(console.error)