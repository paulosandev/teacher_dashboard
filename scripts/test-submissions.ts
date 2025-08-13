#!/usr/bin/env npx tsx

/**
 * Script para probar la obtención de entregas con el token actualizado
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
 * Prueba obtener entregas de un curso específico
 */
async function testCourseSubmissions(courseId: number, courseName: string): Promise<void> {
  console.log(`\n🎓 Probando curso: ${courseName} (ID: ${courseId})`)
  console.log('='.repeat(60))
  
  try {
    // Obtener todas las tareas del curso
    console.log('\n📚 Obteniendo tareas del curso...')
    const assignments = await callMoodleAPI('mod_assign_get_assignments', {
      courseids: [courseId],
    })
    
    if (!assignments.courses || assignments.courses.length === 0) {
      console.log('   ❌ No se encontraron cursos')
      return
    }
    
    const courseAssignments = assignments.courses[0].assignments || []
    console.log(`   ✅ Encontradas ${courseAssignments.length} tareas`)
    
    if (courseAssignments.length === 0) {
      console.log('   ⚠️ No hay tareas en este curso')
      return
    }
    
    // Probar obtener entregas para cada tarea
    console.log('\n📝 Verificando entregas por tarea:')
    
    for (const assignment of courseAssignments.slice(0, 5)) { // Limitar a 5 tareas para la prueba
      console.log(`\n   📋 Tarea: ${assignment.name}`)
      console.log(`      ID: ${assignment.id}`)
      console.log(`      Fecha límite: ${assignment.duedate ? new Date(assignment.duedate * 1000).toLocaleString() : 'Sin fecha límite'}`)
      
      try {
        const submissions = await callMoodleAPI('mod_assign_get_submissions', {
          assignmentids: [assignment.id],
        })
        
        const assignmentSubmissions = submissions.assignments?.[0]?.submissions || []
        console.log(`      ✅ Entregas obtenidas: ${assignmentSubmissions.length}`)
        
        // Analizar las entregas
        let submitted = 0
        let notSubmitted = 0
        const studentsWithSubmissions = new Set()
        
        for (const submission of assignmentSubmissions) {
          if (submission.status === 'submitted') {
            submitted++
            studentsWithSubmissions.add(submission.userid)
          } else {
            notSubmitted++
          }
        }
        
        console.log(`      📊 Resumen:`)
        console.log(`         - Entregados: ${submitted}`)
        console.log(`         - No entregados: ${notSubmitted}`)
        console.log(`         - Estudiantes únicos con entregas: ${studentsWithSubmissions.size}`)
        
        // Mostrar algunos detalles de entregas
        if (submitted > 0) {
          console.log(`      📅 Últimas entregas:`)
          const recentSubmissions = assignmentSubmissions
            .filter((s: any) => s.status === 'submitted')
            .sort((a: any, b: any) => b.timemodified - a.timemodified)
            .slice(0, 3)
          
          for (const sub of recentSubmissions) {
            console.log(`         - Usuario ${sub.userid}: ${new Date(sub.timemodified * 1000).toLocaleString()}`)
          }
        }
        
      } catch (error: any) {
        console.log(`      ❌ Error obteniendo entregas: ${error.message}`)
        
        if (error.message?.includes('Excepción al control de acceso')) {
          console.log(`      ⚠️ No tienes permisos para ver entregas de esta tarea`)
        }
      }
    }
    
  } catch (error: any) {
    console.error(`❌ Error general: ${error.message}`)
  }
}

/**
 * Main
 */
async function main() {
  console.log('🔍 PRUEBA DE OBTENCIÓN DE ENTREGAS CON TOKEN ACTUALIZADO')
  console.log('='.repeat(60))
  console.log(`Token: ${MOODLE_API_TOKEN.substring(0, 8)}...`)
  
  // Obtener información del token
  try {
    const siteInfo = await callMoodleAPI('core_webservice_get_site_info')
    console.log(`\n👤 Usuario del token: ${siteInfo.fullname} (${siteInfo.username})`)
    
    // Verificar que tenemos el permiso necesario
    const hasPermission = siteInfo.functions?.some((f: any) => 
      f.name === 'mod_assign_get_submissions'
    )
    console.log(`🔑 Permiso mod_assign_get_submissions: ${hasPermission ? '✅ SÍ' : '❌ NO'}`)
    
    if (!hasPermission) {
      console.log('\n⚠️ ADVERTENCIA: El token no tiene permisos para obtener entregas')
      console.log('Por favor, asegúrate de que el token tenga el permiso mod_assign_get_submissions')
      return
    }
  } catch (error) {
    console.error('❌ Error obteniendo información del token:', error)
    return
  }
  
  // Probar con cursos conocidos del profesor Cesar
  const testCourses = [
    { 
      id: 1686, 
      name: 'SEMINARIO DESARROLLO DE LA INTELIGENCIA II TET2 2024 OCTUBRE'
    },
    {
      id: 1678,
      name: 'APRENDIZAJE Y MEMORIA TIN4 2024 OCTUBRE'
    }
  ]
  
  // Obtener cursos del usuario para verificar
  console.log('\n📚 Verificando cursos disponibles para el usuario...')
  try {
    const userCourses = await callMoodleAPI('core_enrol_get_users_courses', {
      userid: 29791 // ID del usuario marco.arce
    })
    
    console.log(`Encontrados ${userCourses.length} cursos donde el usuario está inscrito`)
    
    // Buscar los cursos de prueba
    for (const testCourse of testCourses) {
      const found = userCourses.find((c: any) => c.id === testCourse.id)
      if (found) {
        console.log(`   ✅ Curso ${testCourse.id} encontrado: ${found.shortname}`)
        await testCourseSubmissions(testCourse.id, testCourse.name)
      } else {
        console.log(`   ⚠️ Curso ${testCourse.id} no encontrado en los cursos del usuario`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error obteniendo cursos del usuario:', error)
  }
  
  console.log('\n\n✅ Prueba completada')
}

// Ejecutar
main().catch(console.error)
