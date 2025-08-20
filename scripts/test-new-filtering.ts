/**
 * Script para probar el nuevo filtrado que incluye todas las discusiones del grupo
 */

import dotenv from 'dotenv'
import { MoodleAPIClient } from '../lib/moodle/api-client'

dotenv.config()

async function testNewFiltering() {
  console.log('🔍 Probando nuevo filtrado inclusivo...')
  
  const token = '3d39bc049d32b05fa10088e55d910d00'
  const professorUserId = 29895 // ID de julioprofe
  const moodleUrl = process.env.MOODLE_URL!
  
  const client = new MoodleAPIClient(moodleUrl, token)
  
  const courseId = 229
  const groupId = 2267 // Grupo_01
  
  console.log(`👨‍🏫 Profesor ID: ${professorUserId} (julioprofe)`)
  console.log(`🎯 Curso: ${courseId}, Grupo: ${groupId}`)
  
  try {
    // === OBTENER FOROS ===
    console.log('\n💬 Obteniendo foros...')
    const forums = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
      courseids: [courseId]
    })
    
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
    
    console.log(`📊 Total de discusiones: ${discussions.discussions.length}`)
    
    // === NUEVO FILTRADO: SOLO POR GRUPO ===
    const filteredDiscussions = discussions.discussions.filter((d: any) => d.groupid === groupId)
    console.log(`🎯 Discusiones en grupo ${groupId}: ${filteredDiscussions.length}`)
    
    if (filteredDiscussions.length === 0) {
      console.log('❌ No hay discusiones en el grupo')
      return
    }
    
    console.log('\n=== DISCUSIONES DISPONIBLES ===')
    filteredDiscussions.forEach((d: any, index: number) => {
      const isAuthorProfesor = d.userid === professorUserId
      console.log(`${index + 1}. ${isAuthorProfesor ? '👨‍🏫' : '🤝'} "${d.name}"`)
      console.log(`   ID: ${d.id}, Autor: ${d.userid}, Respuestas: ${d.numreplies}`)
    })
    
    // === PROCESAR POSTS CON NUEVO MANEJO DE ERRORES ===
    console.log('\n📝 Procesando posts con manejo robusto...')
    
    let totalPosts = 0
    const processedDiscussions = []
    
    for (const discussion of filteredDiscussions) {
      console.log(`\n📋 Procesando: "${discussion.name}" (ID: ${discussion.id})`)
      
      try {
        // Manejo robusto de errores
        let discussionIdToUse = discussion.id
        let skipDiscussion = false
        
        // Corrección para discusión problemática conocida
        if (discussion.id === 43115 && discussion.name === "Espacio Testing") {
          console.log(`   🔧 CORRECCIÓN: Usando ID 3199 para discusión problemática`)
          discussionIdToUse = 3199
        }
        
        // Saltar discusiones sin respuestas
        if (discussion.numreplies === 0) {
          console.log(`   ⏭️ SALTANDO: Sin respuestas`)
          continue
        }
        
        const posts = await client.callMoodleAPI('mod_forum_get_discussion_posts', {
          discussionid: discussionIdToUse
        })
        
        if (posts && posts.posts && posts.posts.length > 0) {
          console.log(`   ✅ ÉXITO: ${posts.posts.length} posts obtenidos`)
          totalPosts += posts.posts.length
          
          // Analizar participación
          const studentPosts = posts.posts.filter((p: any) => {
            const postUserId = p.author?.id || p.userid
            return postUserId !== professorUserId
          })
          
          console.log(`   👨‍🎓 Posts de estudiantes: ${studentPosts.length}`)
          console.log(`   👨‍🏫 Posts del profesor: ${posts.posts.length - studentPosts.length}`)
          
          if (studentPosts.length > 0) {
            processedDiscussions.push({
              ...discussion,
              posts: posts.posts,
              studentParticipation: studentPosts.length
            })
          }
        } else {
          console.log(`   ⚠️ Sin posts válidos`)
        }
        
      } catch (error) {
        console.log(`   ❌ ERROR: ${error}`)
        // Continuar con la siguiente discusión
        continue
      }
    }
    
    // === RESULTADOS FINALES ===
    console.log('\n=== RESULTADOS FINALES ===')
    console.log(`📊 Discusiones procesadas exitosamente: ${processedDiscussions.length}`)
    console.log(`📝 Total de posts: ${totalPosts}`)
    
    if (processedDiscussions.length > 0) {
      console.log('\n✅ DISCUSIONES CON ACTIVIDAD ESTUDIANTIL:')
      processedDiscussions.forEach((d: any) => {
        console.log(`   📋 "${d.name}" - ${d.studentParticipation} posts de estudiantes`)
      })
      
      console.log('\n🎉 ÉXITO: El foro SÍ se mostraría en la interfaz')
    } else {
      console.log('\n❌ PROBLEMA: No hay discusiones con actividad estudiantil')
      console.log('❌ El foro NO se mostraría en la interfaz')
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error)
  }
}

if (require.main === module) {
  testNewFiltering().catch(console.error)
}

export { testNewFiltering }