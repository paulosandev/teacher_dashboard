/**
 * Script para probar el endpoint completo de actividades
 */

async function testActivitiesEndpoint() {
  console.log('🔍 Probando endpoint de actividades...')
  
  const url = 'http://localhost:3005/api/activities/open?courseId=229|2267'
  
  console.log(`📡 Llamando: ${url}`)
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Simular una sesión básica - en producción esto vendría de NextAuth
        'Cookie': 'next-auth.session-token=test'
      }
    })
    
    if (!response.ok) {
      console.error(`❌ Error HTTP: ${response.status}`)
      const errorText = await response.text()
      console.error(`❌ Respuesta: ${errorText}`)
      return
    }
    
    const data = await response.json()
    
    console.log('✅ Respuesta exitosa del endpoint')
    console.log(`📊 Total de actividades: ${data.activities?.length || 0}`)
    
    if (data.activities && data.activities.length > 0) {
      console.log('\n=== ACTIVIDADES ENCONTRADAS ===')
      
      data.activities.forEach((activity: any, index: number) => {
        console.log(`\n${index + 1}. [${activity.type.toUpperCase()}] ${activity.name}`)
        console.log(`   ID: ${activity.id}`)
        console.log(`   Status: ${activity.status}`)
        
        if (activity.type === 'forum' && activity.forumDetails) {
          const details = activity.forumDetails
          console.log(`   📊 Discusiones: ${details.numdiscussions}`)
          console.log(`   📊 Posts totales: ${details.totalPosts}`)
          console.log(`   📊 Participantes únicos: ${details.uniqueParticipants}`)
          
          if (details.discussions && details.discussions.length > 0) {
            console.log(`   📋 Discusiones:`)
            details.discussions.forEach((disc: any) => {
              console.log(`      - "${disc.name}" (${disc.numreplies} respuestas, ${disc.studentsParticipating} estudiantes)`)
            })
          }
          
          if (details.allPosts && details.allPosts.length > 0) {
            console.log(`   📝 Posts encontrados: ${details.allPosts.length}`)
            const studentPosts = details.allPosts.filter((p: any) => !p.isTeacherPost)
            const teacherPosts = details.allPosts.filter((p: any) => p.isTeacherPost)
            console.log(`      👨‍🎓 Posts de estudiantes: ${studentPosts.length}`)
            console.log(`      👨‍🏫 Posts del profesor: ${teacherPosts.length}`)
            
            if (studentPosts.length > 0) {
              console.log(`   ✅ PARTICIPACIÓN DETECTADA: ${studentPosts.length} posts de estudiantes`)
            } else {
              console.log(`   ❌ NO SE DETECTÓ PARTICIPACIÓN`)
            }
          }
        }
      })
      
      console.log(`\n📊 Resumen: ${data.summary?.total || 0} actividades (${data.summary?.forums || 0} foros, ${data.summary?.assignments || 0} asignaciones)`)
      
    } else {
      console.log('⚠️ No se encontraron actividades')
    }
    
  } catch (error) {
    console.error('❌ Error llamando al endpoint:', error)
  }
}

if (require.main === module) {
  testActivitiesEndpoint().catch(console.error)
}

export { testActivitiesEndpoint }