#!/usr/bin/env npx tsx

/**
 * Script para listar los cursos de marco.arce y probar entregas
 */

import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MOODLE_API_URL = process.env.MOODLE_API_URL!
const MOODLE_API_TOKEN = process.env.MOODLE_API_TOKEN!

/**
 * Realiza una llamada a la API de Moodle
 */
async function callMoodleAPI(wsfunction: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(MOODLE_API_URL)
  
  const baseParams = {
    wstoken: MOODLE_API_TOKEN,
    wsfunction: wsfunction,
    moodlewsrestformat: 'json',
  }

  const allParams: Record<string, any> = { ...baseParams, ...params }

  Object.keys(allParams).forEach(key => {
    if (Array.isArray(allParams[key])) {
      allParams[key].forEach((value: any, index: number) => {
        url.searchParams.append(`${key}[${index}]`, value.toString())
      })
    } else {
      url.searchParams.append(key, allParams[key].toString())
    }
  })

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    if (data.exception) {
      throw new Error(`Moodle error: ${data.message || data.exception}`)
    }

    return data
  } catch (error) {
    console.error(`❌ Error llamando ${wsfunction}:`, error)
    throw error
  }
}

/**
 * Main
 */
async function main() {
  console.log('🔍 CURSOS DE MARCO.ARCE Y PRUEBA DE ENTREGAS')
  console.log('='.repeat(60))
  
  // Obtener información del token
  const siteInfo = await callMoodleAPI('core_webservice_get_site_info')
  console.log(`\n👤 Usuario: ${siteInfo.fullname} (${siteInfo.username})`)
  console.log(`   ID: ${siteInfo.userid}`)
  
  // Obtener cursos del usuario
  console.log('\n📚 Cursos donde el usuario está inscrito:')
  const userCourses = await callMoodleAPI('core_enrol_get_users_courses', {
    userid: siteInfo.userid
  })
  
  console.log(`\nTotal: ${userCourses.length} cursos\n`)
  
  // Listar los cursos
  for (const course of userCourses) {
    console.log(`📘 ${course.shortname}`)
    console.log(`   ID: ${course.id}`)
    console.log(`   Nombre completo: ${course.fullname}`)
    console.log(`   Categoría: ${course.category}`)
    
    // Verificar rol en el curso
    try {
      const enrolledUsers = await callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: course.id,
        options: [
          { name: 'userfields', value: 'id,username,firstname,lastname,email' },
          { name: 'limitnumber', value: '100' }
        ]
      })
      
      const currentUser = enrolledUsers.find((u: any) => u.id === siteInfo.userid)
      if (currentUser && currentUser.roles) {
        const roles = currentUser.roles.map((r: any) => r.shortname).join(', ')
        console.log(`   Rol: ${roles}`)
      }
    } catch (error) {
      console.log(`   Rol: No se pudo determinar`)
    }
    console.log()
  }
  
  // Seleccionar el primer curso con tareas para probar
  console.log('\n🧪 PRUEBA DE ENTREGAS')
  console.log('='.repeat(60))
  
  for (const course of userCourses.slice(0, 3)) { // Probar solo los primeros 3 cursos
    console.log(`\n📘 Probando curso: ${course.shortname}`)
    
    try {
      // Obtener tareas del curso
      const assignments = await callMoodleAPI('mod_assign_get_assignments', {
        courseids: [course.id],
      })
      
      const courseAssignments = assignments.courses?.[0]?.assignments || []
      
      if (courseAssignments.length === 0) {
        console.log('   ⚠️ No hay tareas en este curso')
        continue
      }
      
      console.log(`   ✅ Encontradas ${courseAssignments.length} tareas`)
      
      // Probar la primera tarea
      const firstAssignment = courseAssignments[0]
      console.log(`\n   📝 Probando tarea: ${firstAssignment.name}`)
      console.log(`      ID: ${firstAssignment.id}`)
      
      try {
        const submissions = await callMoodleAPI('mod_assign_get_submissions', {
          assignmentids: [firstAssignment.id],
        })
        
        const assignmentSubmissions = submissions.assignments?.[0]?.submissions || []
        console.log(`      ✅ ÉXITO: Se obtuvieron ${assignmentSubmissions.length} entregas`)
        
        // Contar estados
        const statusCount: Record<string, number> = {}
        for (const sub of assignmentSubmissions) {
          statusCount[sub.status] = (statusCount[sub.status] || 0) + 1
        }
        
        console.log(`      📊 Estados de entregas:`)
        for (const [status, count] of Object.entries(statusCount)) {
          console.log(`         - ${status}: ${count}`)
        }
        
        // Si hay entregas, mostrar un ejemplo
        if (assignmentSubmissions.length > 0) {
          const example = assignmentSubmissions[0]
          console.log(`\n      🔍 Ejemplo de entrega:`)
          console.log(`         - Usuario ID: ${example.userid}`)
          console.log(`         - Estado: ${example.status}`)
          console.log(`         - Última modificación: ${new Date(example.timemodified * 1000).toLocaleString()}`)
        }
        
        // ÉXITO: Si llegamos aquí, podemos obtener entregas
        console.log(`\n   🎉 ¡CONFIRMADO: El token puede obtener entregas en este curso!`)
        break // Salir después del primer éxito
        
      } catch (error: any) {
        console.log(`      ❌ Error: ${error.message}`)
      }
      
    } catch (error: any) {
      console.log(`   ❌ Error obteniendo tareas: ${error.message}`)
    }
  }
  
  console.log('\n\n✅ Prueba completada')
  console.log('\n💡 RECOMENDACIONES:')
  console.log('1. Si el token puede obtener entregas en cursos donde marco.arce está inscrito,')
  console.log('   pero no en los cursos del profesor César, es porque marco.arce no tiene')
  console.log('   acceso a esos cursos.')
  console.log('\n2. Opciones:')
  console.log('   a) Inscribir a marco.arce en los cursos del profesor César con rol apropiado')
  console.log('   b) Usar el token del profesor César directamente')
  console.log('   c) Implementar el sistema de tokens por profesor como propusimos')
}

// Ejecutar
main().catch(console.error)
