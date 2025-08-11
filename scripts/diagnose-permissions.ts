/**
 * Script para diagnosticar problemas específicos con permisos de Moodle
 */

import dotenv from 'dotenv'
dotenv.config()

const MOODLE_URL = process.env.MOODLE_API_URL
const TOKEN = process.env.MOODLE_API_TOKEN

async function testEndpoint(wsfunction: string, params: Record<string, any> = {}) {
  const url = new URL(MOODLE_URL!)
  url.searchParams.append('wstoken', TOKEN!)
  url.searchParams.append('wsfunction', wsfunction)
  url.searchParams.append('moodlewsrestformat', 'json')
  
  // Agregar parámetros adicionales
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        url.searchParams.append(`${key}[${i}]`, v.toString())
      })
    } else {
      url.searchParams.append(key, value.toString())
    }
  })
  
  try {
    const response = await fetch(url.toString())
    const data = await response.json()
    
    if (data.exception || data.errorcode) {
      return {
        success: false,
        error: data.message || data.exception || data.errorcode,
        debuginfo: data.debuginfo
      }
    }
    
    return {
      success: true,
      data: data
    }
  } catch (error) {
    return {
      success: false,
      error: String(error)
    }
  }
}

async function diagnosePermissions() {
  console.log('🔍 Diagnóstico Detallado de Permisos\n')
  console.log('=' .repeat(60))
  
  // 1. Probar mod_forum_get_forum_discussions con diferentes parámetros
  console.log('\n1️⃣ PROBANDO: mod_forum_get_forum_discussions')
  console.log('-'.repeat(60))
  
  // Primero obtener un foro válido
  const forumsResult = await testEndpoint('mod_forum_get_forums_by_courses', {
    courseids: [138] // Curso de Criminología
  })
  
  if (forumsResult.success && forumsResult.data.length > 0) {
    const firstForum = forumsResult.data[0]
    console.log(`✅ Foro encontrado: ${firstForum.name} (ID: ${firstForum.id})`)
    
    // Probar diferentes variaciones de parámetros
    console.log('\nProbando con parámetros mínimos...')
    let result = await testEndpoint('mod_forum_get_forum_discussions', {
      forumid: firstForum.id
    })
    
    if (!result.success) {
      console.log(`❌ Error con parámetros mínimos: ${result.error}`)
      if (result.debuginfo) {
        console.log(`   Debug: ${result.debuginfo}`)
      }
      
      // Probar con parámetros adicionales
      console.log('\nProbando con parámetros completos...')
      result = await testEndpoint('mod_forum_get_forum_discussions', {
        forumid: firstForum.id,
        sortby: 'timemodified',
        sortdirection: 'DESC',
        page: 0,
        perpage: 10
      })
      
      if (!result.success) {
        console.log(`❌ Error con parámetros completos: ${result.error}`)
      } else {
        console.log(`✅ Funciona con parámetros completos`)
        console.log(`   Discusiones obtenidas: ${result.data.discussions?.length || 0}`)
      }
    } else {
      console.log(`✅ Funciona con parámetros mínimos`)
      console.log(`   Discusiones obtenidas: ${result.data.discussions?.length || 0}`)
    }
    
    // Probar mod_forum_get_forum_discussions_paginated (alternativa)
    console.log('\nProbando endpoint alternativo: mod_forum_get_forum_discussions_paginated...')
    result = await testEndpoint('mod_forum_get_forum_discussions_paginated', {
      forumid: firstForum.id,
      sortby: 'timemodified',
      sortdirection: 'DESC',
      page: 0,
      perpage: 10
    })
    
    if (result.success) {
      console.log(`✅ Endpoint alternativo funciona`)
      console.log(`   Discusiones: ${result.data.discussions?.length || 0}`)
    } else {
      console.log(`❌ Endpoint alternativo no disponible: ${result.error}`)
    }
  }
  
  // 2. Probar core_course_get_contents
  console.log('\n2️⃣ PROBANDO: core_course_get_contents')
  console.log('-'.repeat(60))
  
  console.log('Probando con curso 138 (Criminología)...')
  let contentResult = await testEndpoint('core_course_get_contents', {
    courseid: 138
  })
  
  if (!contentResult.success) {
    console.log(`❌ Sin acceso al contenido: ${contentResult.error}`)
    
    // Probar con opciones adicionales
    console.log('\nProbando con opciones adicionales...')
    contentResult = await testEndpoint('core_course_get_contents', {
      courseid: 138,
      options: [
        { name: 'excludemodules', value: '0' },
        { name: 'excludecontents', value: '0' }
      ]
    })
    
    if (!contentResult.success) {
      console.log(`❌ Sigue sin acceso: ${contentResult.error}`)
    } else {
      console.log(`✅ Funciona con opciones adicionales`)
    }
  } else {
    console.log(`✅ Acceso al contenido exitoso`)
    console.log(`   Secciones: ${contentResult.data.length}`)
  }
  
  // 3. Probar alternativas para obtener actividades
  console.log('\n3️⃣ PROBANDO ALTERNATIVAS PARA ACTIVIDADES')
  console.log('-'.repeat(60))
  
  // Probar mod_assign_get_assignments
  console.log('\nProbando mod_assign_get_assignments (tareas)...')
  const assignResult = await testEndpoint('mod_assign_get_assignments', {
    courseids: [138]
  })
  
  if (assignResult.success) {
    console.log(`✅ Acceso a tareas exitoso`)
    const courses = assignResult.data.courses || []
    if (courses.length > 0 && courses[0].assignments) {
      console.log(`   Tareas encontradas: ${courses[0].assignments.length}`)
    }
  } else {
    console.log(`❌ Sin acceso a tareas: ${assignResult.error}`)
  }
  
  // Probar mod_quiz_get_quizzes_by_courses
  console.log('\nProbando mod_quiz_get_quizzes_by_courses (cuestionarios)...')
  const quizResult = await testEndpoint('mod_quiz_get_quizzes_by_courses', {
    courseids: [138]
  })
  
  if (quizResult.success) {
    console.log(`✅ Acceso a cuestionarios exitoso`)
    console.log(`   Cuestionarios encontrados: ${quizResult.data.quizzes?.length || 0}`)
  } else {
    console.log(`❌ Sin acceso a cuestionarios: ${quizResult.error}`)
  }
  
  // 4. Verificar permisos de usuario inscritos
  console.log('\n4️⃣ PROBANDO: core_enrol_get_enrolled_users')
  console.log('-'.repeat(60))
  
  const enrolledResult = await testEndpoint('core_enrol_get_enrolled_users', {
    courseid: 138
  })
  
  if (enrolledResult.success) {
    console.log(`✅ Acceso a usuarios inscritos`)
    console.log(`   Usuarios encontrados: ${enrolledResult.data.length}`)
  } else {
    console.log(`❌ Sin acceso a usuarios inscritos: ${enrolledResult.error}`)
  }
  
  // Resumen final
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE DIAGNÓSTICO')
  console.log('='.repeat(60))
  console.log('\n⚠️  FUNCIONES QUE NECESITAN ATENCIÓN:')
  console.log('\n1. mod_forum_get_forum_discussions')
  console.log('   - Posible problema con parámetros, no permisos')
  console.log('   - Alternativa: mod_forum_get_forum_discussions_paginated')
  console.log('\n2. core_course_get_contents')
  console.log('   - Requiere permisos adicionales')
  console.log('   - Alternativas: usar endpoints específicos por tipo de actividad')
  console.log('\n3. core_enrol_get_enrolled_users')
  console.log('   - Útil para análisis pero no crítico')
  
  console.log('\n💡 RECOMENDACIONES:')
  console.log('- Para discusiones: ajustar parámetros o usar endpoint paginado')
  console.log('- Para actividades: usar endpoints específicos (assign, quiz, etc.)')
  console.log('- El sistema puede funcionar sin estos permisos usando alternativas')
}

// Ejecutar
diagnosePermissions().catch(console.error)
