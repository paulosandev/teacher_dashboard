/**
 * Script para probar la detección de participación con IDs correctos
 */

import dotenv from 'dotenv'
import { MoodleAPIClient } from '../lib/moodle/api-client'

dotenv.config()

async function testParticipationDetection() {
  console.log('🔍 Probando detección de participación...')
  
  const token = '3d39bc049d32b05fa10088e55d910d00'
  const professorUserId = 29895 // ID de julioprofe
  const moodleUrl = process.env.MOODLE_URL!
  
  const client = new MoodleAPIClient(moodleUrl, token)
  
  console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
  
  try {
    // Obtener posts de la discusión que sabemos tiene participación
    const posts = await client.callMoodleAPI('mod_forum_get_discussion_posts', {
      discussionid: 3199 // Discusión "Espacio Testing"
    })
    
    console.log(`📝 Posts obtenidos: ${posts.posts?.length || 0}`)
    
    if (posts.posts) {
      console.log('\n=== ANÁLISIS DE PARTICIPACIÓN ===')
      
      const allParticipants = new Set<number>()
      const studentParticipants = new Set<number>()
      const teacherPosts: any[] = []
      const studentPosts: any[] = []
      
      posts.posts.forEach((post: any, index: number) => {
        const postUserId = post.author?.id || post.userid || post.userId
        allParticipants.add(postUserId)
        
        console.log(`\n📄 Post ${index + 1}:`)
        console.log(`   ID: ${post.id}`)
        console.log(`   Autor: ${post.author?.fullname || 'Desconocido'}`)
        console.log(`   Autor ID: ${postUserId}`)
        console.log(`   Asunto: ${post.subject}`)
        
        const isTeacher = postUserId === professorUserId
        console.log(`   Es profesor: ${isTeacher ? 'SÍ' : 'NO'}`)
        
        if (isTeacher) {
          teacherPosts.push(post)
          console.log(`   ✅ Post del profesor detectado`)
        } else {
          studentParticipants.add(postUserId)
          studentPosts.push(post)
          console.log(`   👨‍🎓 Post de estudiante detectado`)
        }
      })
      
      console.log('\n=== RESUMEN DE PARTICIPACIÓN ===')
      console.log(`📊 Total participantes únicos: ${allParticipants.size}`)
      console.log(`👨‍🏫 Posts del profesor: ${teacherPosts.length}`)
      console.log(`👨‍🎓 Posts de estudiantes: ${studentPosts.length}`)
      console.log(`👥 Estudiantes únicos participando: ${studentParticipants.size}`)
      
      console.log(`\n📋 Lista de participantes:`)
      allParticipants.forEach(userId => {
        const isTeacher = userId === professorUserId
        const post = posts.posts.find((p: any) => (p.author?.id || p.userid) === userId)
        const userName = post?.author?.fullname || 'Desconocido'
        console.log(`   ${isTeacher ? '👨‍🏫' : '👨‍🎓'} ${userName} (ID: ${userId})`)
      })
      
      if (studentParticipants.size > 0) {
        console.log('\n✅ PARTICIPACIÓN DETECTADA CORRECTAMENTE')
        console.log(`✅ Se encontraron ${studentParticipants.size} estudiantes participando`)
      } else {
        console.log('\n❌ PROBLEMA: No se detectó participación de estudiantes')
        console.log('❌ Esto indica un error en la lógica de filtrado')
      }
      
    } else {
      console.log('⚠️ No se encontraron posts')
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
  }
}

if (require.main === module) {
  testParticipationDetection().catch(console.error)
}

export { testParticipationDetection }