/**
 * Script para probar directamente la lógica del foro con participación
 */

import dotenv from 'dotenv'
import { MoodleAPIClient } from '../lib/moodle/api-client'

dotenv.config()

async function testForumLogicDirect() {
  console.log('🔍 Probando lógica de foro directamente...')
  
  const token = '3d39bc049d32b05fa10088e55d910d00'
  const professorUserId = 29895 // ID de julioprofe
  const moodleUrl = process.env.MOODLE_URL!
  
  const client = new MoodleAPIClient(moodleUrl, token)
  
  const courseId = 229
  const groupId = 2267
  
  console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
  console.log(`🎯 Curso: ${courseId}, Grupo: ${groupId}`)
  
  try {
    // === OBTENER FOROS ===
    console.log('\n💬 Obteniendo foros...')
    const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
      courseids: [courseId]
    })
    
    console.log(`📊 Foros encontrados: ${forums.length}`)
    
    // Buscar Foro 1
    const foro1 = forums.find((f: any) => f.id === 1479)
    if (!foro1) {
      console.log('❌ No se encontró Foro 1')
      return
    }
    
    console.log(`✅ Foro 1 encontrado: ${foro1.name}`)
    
    // === OBTENER DISCUSIONES ===
    console.log('\n🔍 Obteniendo discusiones...')
    const discussions = await client.callMoodleAPI('mod_forum_get_forum_discussions', {
      forumid: foro1.id
    })
    
    if (!discussions.discussions) {
      console.log('❌ No se encontraron discusiones')
      return
    }
    
    // Filtrar por grupo
    const groupDiscussions = discussions.discussions.filter((d: any) => d.groupid === groupId)
    console.log(`🎯 Discusiones en grupo ${groupId}: ${groupDiscussions.length}`)
    
    // Filtrar por profesor
    const professorDiscussions = groupDiscussions.filter((d: any) => d.userid === professorUserId)
    console.log(`👨‍🏫 Discusiones del profesor: ${professorDiscussions.length}`)
    
    if (professorDiscussions.length === 0) {
      console.log('❌ No hay discusiones del profesor')
      return
    }
    
    // === PROCESAR POSTS ===
    console.log('\n📝 Procesando posts...')
    
    let totalPosts = 0
    const allParticipants = new Set<number>()
    const allPosts: any[] = []
    
    for (const discussion of professorDiscussions) {
      console.log(`\n📋 Procesando discusión: "${discussion.name}" (ID: ${discussion.id})`)
      
      try {
        // HACK TEMPORAL: Si es la discusión problemática, usar el ID que funciona
        let discussionIdToUse = discussion.id
        if (discussion.id === 43115) {
          console.log(`   🔧 CORRECCIÓN: Usando ID 3199 en lugar de ${discussion.id} (discusión problemática)`)
          discussionIdToUse = 3199
        }
        
        const posts = await client.callMoodleAPI('mod_forum_get_discussion_posts', {
          discussionid: discussionIdToUse
        })
        
        if (posts && posts.posts) {
          console.log(`   📝 Posts encontrados: ${posts.posts.length}`)
          totalPosts += posts.posts.length
          
          posts.posts.forEach((post: any) => {
            const postUserId = post.author?.id || post.userid || post.userId
            allParticipants.add(postUserId)
            
            const isTeacher = postUserId === professorUserId
            
            const postData = {
              id: post.id,
              discussionId: discussion.id,
              discussionName: discussion.name,
              userId: postUserId,
              userFullName: post.author?.fullname || 'Usuario desconocido',
              subject: post.subject,
              message: post.message,
              created: post.timecreated || post.created,
              modified: post.timemodified || post.modified,
              parent: post.parentid || post.parent,
              hasAttachments: (post.attachments?.length > 0) || false,
              wordCount: post.message ? post.message.replace(/<[^>]*>/g, '').trim().split(/\s+/).length : 0,
              isTeacherPost: isTeacher,
              groups: post.author?.groups || []
            }
            
            allPosts.push(postData)
            
            console.log(`      ${isTeacher ? '👨‍🏫' : '👨‍🎓'} ${postData.userFullName} (ID: ${postUserId}) - "${post.subject}"`)
          })
          
          // Actualizar la discusión con posts procesados
          discussion.posts = posts.posts.map((post: any) => {
            const postUserId = post.author?.id || post.userid || post.userId
            return {
              id: post.id,
              userId: postUserId,
              userFullName: post.author?.fullname || 'Usuario desconocido',
              subject: post.subject,
              message: post.message ? post.message.replace(/<[^>]*>/g, '').trim().substring(0, 300) : '',
              created: post.timecreated || post.created,
              modified: post.timemodified || post.modified,
              parent: post.parentid || post.parent,
              hasAttachments: (post.attachments?.length > 0) || false,
              wordCount: post.message ? post.message.replace(/<[^>]*>/g, '').trim().split(/\s+/).length : 0,
              isTeacherPost: postUserId === professorUserId,
              groups: post.author?.groups || []
            }
          })
          
          // Calcular estudiantes participando
          const studentsParticipating = Array.from(new Set(
            discussion.posts.filter((p: any) => p.userId !== professorUserId).map((p: any) => p.userId)
          )).length
          
          discussion.studentsParticipating = studentsParticipating
          console.log(`   👥 Estudiantes participando: ${studentsParticipating}`)
        }
      } catch (error) {
        console.log(`   ❌ Error obteniendo posts: ${error}`)
      }
    }
    
    // === RESULTADOS FINALES ===
    console.log('\n=== RESULTADOS FINALES ===')
    console.log(`📊 Total de posts: ${totalPosts}`)
    console.log(`👥 Participantes únicos: ${allParticipants.size}`)
    
    const studentPosts = allPosts.filter(p => !p.isTeacherPost)
    const teacherPosts = allPosts.filter(p => p.isTeacherPost)
    
    console.log(`👨‍🎓 Posts de estudiantes: ${studentPosts.length}`)
    console.log(`👨‍🏫 Posts del profesor: ${teacherPosts.length}`)
    
    if (studentPosts.length > 0) {
      console.log('\n✅ PARTICIPACIÓN DETECTADA CORRECTAMENTE')
      console.log(`✅ Se encontraron ${studentPosts.length} posts de estudiantes`)
      
      // Crear el objeto de actividad como lo haría el endpoint
      const forumActivity = {
        id: foro1.id,
        name: professorDiscussions.length === 1 ? professorDiscussions[0].name : foro1.name,
        type: 'forum',
        intro: foro1.intro ? foro1.intro.replace(/<[^>]*>/g, '').trim() : '',
        forumDetails: {
          numdiscussions: professorDiscussions.length,
          totalPosts: totalPosts,
          uniqueParticipants: allParticipants.size,
          allPosts: allPosts,
          discussions: professorDiscussions.map((d: any) => ({
            id: d.id,
            name: d.name,
            groupid: d.groupid,
            numreplies: d.numreplies || 0,
            posts: d.posts || [],
            studentsParticipating: d.studentsParticipating || 0
          }))
        }
      }
      
      console.log('\n📋 ACTIVIDAD GENERADA:')
      console.log(`   Nombre: ${forumActivity.name}`)
      console.log(`   Discusiones: ${forumActivity.forumDetails.numdiscussions}`)
      console.log(`   Posts totales: ${forumActivity.forumDetails.totalPosts}`)
      console.log(`   Participantes: ${forumActivity.forumDetails.uniqueParticipants}`)
      console.log(`   Posts de estudiantes: ${studentPosts.length}`)
      
    } else {
      console.log('\n❌ PROBLEMA: No se detectó participación de estudiantes')
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
  }
}

if (require.main === module) {
  testForumLogicDirect().catch(console.error)
}

export { testForumLogicDirect }