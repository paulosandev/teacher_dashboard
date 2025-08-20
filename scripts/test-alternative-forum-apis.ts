/**
 * Script para probar APIs alternativas de Moodle para obtener posts de foros
 */

import dotenv from 'dotenv'
import { MoodleAPIClient } from '../lib/moodle/api-client'

// Cargar variables de entorno
dotenv.config()

async function testAlternativeForumAPIs() {
  console.log('🔍 Probando APIs alternativas para obtener posts de foros...')
  
  // Token para testing (usar el token de julioprofe - profesor)
  const token = '3d39bc049d32b05fa10088e55d910d00' // Token de julioprofe con permisos de profesor
  const moodleUrl = process.env.MOODLE_URL!
  
  // Crear cliente con URL y token específicos
  console.log(`🔧 Configurando cliente con URL: ${moodleUrl}`)
  console.log(`🔧 Token disponible: ${token ? 'SÍ' : 'NO'}`)
  const client = new MoodleAPIClient(moodleUrl, token)
  
  const forumId = 1479  // Foro 1 donde está "Espacio Testing"
  const discussionId = 3199   // ID alternativo de "Espacio Testing" (discussion field)
  
  // Lista de APIs alternativas para probar
  const apisToTest = [
    // Método 1: API estándar de posts (ya sabemos que falla)
    {
      name: 'mod_forum_get_forum_discussion_posts',
      params: { discussionid: discussionId }
    },
    
    // Método 2: API de posts por foro
    {
      name: 'mod_forum_get_forum_posts',
      params: { forumid: forumId }
    },
    
    // Método 3: API de posts recientes
    {
      name: 'mod_forum_get_forum_posts_by_user',
      params: { forumid: forumId, userid: 0 }
    },
    
    // Método 4: API de contenido del curso (podría incluir posts)
    {
      name: 'core_course_get_contents',
      params: { courseid: 229, options: [{ name: 'includestealthmodules', value: 1 }] }
    },
    
    // Método 5: API de módulos del curso
    {
      name: 'core_course_get_course_module',
      params: { cmid: 16921 }  // CM ID del foro
    },
    
    // Método 6: API genérica de webservice
    {
      name: 'core_webservice_get_site_info',
      params: {}
    },
    
    // Método 7: API de posts con diferentes parámetros
    {
      name: 'mod_forum_get_discussion_posts',
      params: { discussionid: discussionId }
    },
    
    // Método 8: API de foros con parámetros extendidos
    {
      name: 'mod_forum_get_forums_by_courses',
      params: { 
        courseids: [229],
        options: {
          discussions: true,
          posts: true
        }
      }
    },
    
    // Método 9: API de actividades
    {
      name: 'core_course_get_course_module_by_instance',
      params: { 
        module: 'forum',
        instance: forumId
      }
    },
    
    // Método 10: Buscar en servicios disponibles
    {
      name: 'core_webservice_get_site_info',
      params: {}
    }
  ]
  
  console.log(`🧪 Probando ${apisToTest.length} APIs diferentes...\n`)
  
  for (const api of apisToTest) {
    try {
      console.log(`🔄 Probando: ${api.name}`)
      console.log(`   Parámetros:`, JSON.stringify(api.params, null, 2))
      
      const result = await client.callMoodleAPI(api.name, api.params)
      
      console.log(`✅ ${api.name}: FUNCIONA`)
      console.log(`   Respuesta (primeros 500 chars):`, JSON.stringify(result, null, 2).substring(0, 500))
      
      // Buscar si contiene información de posts
      const resultStr = JSON.stringify(result).toLowerCase()
      if (resultStr.includes('post') || resultStr.includes('message') || resultStr.includes('discussion')) {
        console.log(`🎯 ${api.name}: CONTIENE INFORMACIÓN DE POSTS/MENSAJES`)
      }
      
      console.log('')
      
    } catch (error: any) {
      console.log(`❌ ${api.name}: FALLA`)
      console.log(`   Error: ${error.message}`)
      console.log('')
    }
  }
  
  console.log('🏁 Prueba de APIs completada.')
  
  // PASO ADICIONAL: Obtener funciones disponibles y filtrar por forum
  console.log('\n🔍 === ANALIZANDO FUNCIONES DISPONIBLES ===')
  try {
    const siteInfo = await client.callMoodleAPI('core_webservice_get_site_info')
    
    if (siteInfo && siteInfo.functions) {
      console.log(`📋 Total de funciones disponibles: ${siteInfo.functions.length}`)
      
      // Filtrar funciones relacionadas con foros
      const forumFunctions = siteInfo.functions.filter((func: any) => 
        func.name.toLowerCase().includes('forum') ||
        func.name.toLowerCase().includes('discussion') ||
        func.name.toLowerCase().includes('post')
      )
      
      console.log('\n💬 === FUNCIONES DE FORO DISPONIBLES ===')
      forumFunctions.forEach((func: any) => {
        console.log(`   ✅ ${func.name} (versión: ${func.version})`)
      })
      
      if (forumFunctions.length === 0) {
        console.log('   ❌ No hay funciones de foro disponibles')
        
        // Buscar funciones que podrían contener información de posts
        const alternativeFunctions = siteInfo.functions.filter((func: any) => 
          func.name.toLowerCase().includes('content') ||
          func.name.toLowerCase().includes('course') ||
          func.name.toLowerCase().includes('module') ||
          func.name.toLowerCase().includes('activity')
        )
        
        console.log('\n🔄 === FUNCIONES ALTERNATIVAS (curso/contenido) ===')
        alternativeFunctions.slice(0, 10).forEach((func: any) => {
          console.log(`   🔹 ${func.name}`)
        })
      }
    }
  } catch (error) {
    console.error('Error obteniendo funciones disponibles:', error)
  }
  
  // PASO FINAL: Probar APIs alternativas que funcionan
  console.log('\n🎯 === PROBANDO APIs ALTERNATIVAS ===')
  
  // Probar con parámetros alternativos
  try {
    console.log('🔄 Probando mod_forum_get_forums_by_courses con opciones extendidas...')
    const forumsWithDetails = await client.callMoodleAPI('mod_forum_get_forums_by_courses', {
      courseids: [229]
    })
    
    console.log('✅ mod_forum_get_forums_by_courses: ¡FUNCIONA!')
    console.log('📝 Respuesta completa:', JSON.stringify(forumsWithDetails, null, 2))
    
  } catch (error) {
    console.error('❌ Error probando foros con detalles:', error)
  }
  
  // Probar obtener posts específicos  
  try {
    console.log('🔄 Probando mod_forum_get_discussion_posts con discussionId 43115...')
    const posts = await client.callMoodleAPI('mod_forum_get_discussion_posts', {
      discussionid: discussionId
    })
    
    console.log('✅ mod_forum_get_discussion_posts: ¡FUNCIONA!')
    console.log('📝 Respuesta completa:', JSON.stringify(posts, null, 2))
    
    if (posts && posts.posts) {
      console.log(`\n📊 ANÁLISIS DE POSTS:`)
      console.log(`   📝 Total de posts: ${posts.posts.length}`)
      
      posts.posts.forEach((post: any, index: number) => {
        console.log(`\n   ${index + 1}. Post ID: ${post.id}`)
        console.log(`      👤 Usuario: ${post.userid}`)
        console.log(`      📅 Creado: ${new Date(post.created * 1000).toLocaleString()}`)
        console.log(`      📋 Asunto: ${post.subject}`)
        console.log(`      💬 Mensaje (primeros 200 chars): ${post.message.substring(0, 200)}...`)
        console.log(`      🔗 Parent: ${post.parent}`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error probando API correcta:', error)
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  testAlternativeForumAPIs().catch(console.error)
}

export { testAlternativeForumAPIs }