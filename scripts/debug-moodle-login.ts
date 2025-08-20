// Script para diagnosticar problemas de login con Moodle
import * as dotenv from 'dotenv'
dotenv.config()

import { moodleAuthService } from '../lib/auth/moodle-auth-service'

async function debugMoodleLogin() {
  console.log('🔍 DIAGNÓSTICO DE LOGIN MOODLE')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  const username = 'cesar.espindola'
  const password = 'admin1234'
  
  console.log(`👤 Usuario a probar: ${username}`)
  console.log(`🔑 Contraseña: ${password}`)
  console.log(`🌐 URL Moodle: ${process.env.MOODLE_URL}`)
  
  try {
    console.log('\n🔄 PASO 1: Intentando obtener token directamente...')
    
    // Probar directamente la obtención de token
    const tokenUrl = `${process.env.MOODLE_URL}/login/token.php`
    
    const params = new URLSearchParams({
      username,
      password,
      service: 'moodle_mobile_app'
    })

    console.log(`📡 URL de token: ${tokenUrl}`)
    console.log(`📋 Parámetros: username=${username}, service=moodle_mobile_app`)

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    })

    console.log(`📊 Status HTTP: ${response.status} ${response.statusText}`)

    const data = await response.json()
    console.log(`📄 Respuesta completa:`, JSON.stringify(data, null, 2))

    if (data.error) {
      console.log(`❌ ERROR EN TOKEN:`)
      console.log(`   Código: ${data.errorcode || 'No especificado'}`)
      console.log(`   Mensaje: ${data.error}`)
      console.log(`   Excepción: ${data.exception || 'No especificada'}`)
      
      // Diagnóstico del error
      if (data.error.includes('Invalid login')) {
        console.log('\n💡 POSIBLES CAUSAS:')
        console.log('   1. Usuario o contraseña incorrectos')
        console.log('   2. Usuario deshabilitado en Moodle')
        console.log('   3. Usuario no tiene permisos de web service')
      } else if (data.error.includes('Web service not available')) {
        console.log('\n💡 POSIBLES CAUSAS:')
        console.log('   1. Web services no habilitados en Moodle')
        console.log('   2. Servicio moodle_mobile_app no configurado')
        console.log('   3. Usuario no autorizado para web services')
      }
      
      return
    }

    if (data.token) {
      console.log(`✅ TOKEN OBTENIDO EXITOSAMENTE!`)
      console.log(`🔑 Token: ${data.token.substring(0, 20)}...`)
      
      console.log('\n🔄 PASO 2: Probando token con site info...')
      
      // Probar el token
      const siteInfoUrl = `${process.env.MOODLE_URL}/webservice/rest/server.php`
      const siteParams = new URLSearchParams({
        wstoken: data.token,
        wsfunction: 'core_webservice_get_site_info',
        moodlewsrestformat: 'json'
      })

      const siteResponse = await fetch(`${siteInfoUrl}?${siteParams}`)
      const siteData = await siteResponse.json()
      
      console.log(`📊 Site info status: ${siteResponse.status}`)
      
      if (siteData.errorcode) {
        console.log(`❌ Error en site info:`, siteData)
        return
      }
      
      console.log(`✅ INFORMACIÓN DEL SITIO:`)
      console.log(`   Sitio: ${siteData.sitename}`)
      console.log(`   Usuario: ${siteData.username}`)
      console.log(`   Nombre: ${siteData.firstname} ${siteData.lastname}`)
      console.log(`   Email: ${siteData.useremail}`)
      console.log(`   User ID: ${siteData.userid}`)
      
      console.log('\n🔄 PASO 3: Verificando rol de profesor...')
      
      // Verificar cursos del usuario
      const coursesParams = new URLSearchParams({
        wstoken: data.token,
        wsfunction: 'core_enrol_get_users_courses',
        moodlewsrestformat: 'json',
        'userid': siteData.userid.toString()
      })

      const coursesResponse = await fetch(`${siteInfoUrl}?${coursesParams}`)
      const coursesData = await coursesResponse.json()
      
      if (coursesData.errorcode) {
        console.log(`❌ Error obteniendo cursos:`, coursesData)
        return
      }
      
      console.log(`📚 CURSOS ENCONTRADOS: ${coursesData.length}`)
      
      if (coursesData.length === 0) {
        console.log(`⚠️ El usuario no tiene cursos asignados`)
        console.log(`💡 POSIBLES CAUSAS:`)
        console.log(`   1. Usuario no está inscrito en ningún curso`)
        console.log(`   2. No tiene rol de profesor en ningún curso`)
        return
      }
      
      // Verificar rol en cada curso
      let isTeacherInAnyCourse = false
      
      for (const course of coursesData.slice(0, 3)) { // Solo primeros 3 cursos
        console.log(`\n📖 Verificando curso: ${course.fullname} (ID: ${course.id})`)
        
        try {
          const usersParams = new URLSearchParams({
            wstoken: data.token,
            wsfunction: 'core_enrol_get_enrolled_users',
            moodlewsrestformat: 'json',
            'courseid': course.id.toString()
          })

          const usersResponse = await fetch(`${siteInfoUrl}?${usersParams}`)
          const usersData = await usersResponse.json()
          
          if (usersData.errorcode) {
            console.log(`   ❌ Error obteniendo usuarios: ${usersData.error}`)
            continue
          }
          
          const userInCourse = usersData.find((u: any) => u.id === siteData.userid)
          
          if (userInCourse && userInCourse.roles) {
            console.log(`   👤 Roles encontrados:`)
            userInCourse.roles.forEach((role: any) => {
              console.log(`      - ${role.name || role.shortname} (ID: ${role.roleid})`)
            })
            
            const hasTeacherRole = userInCourse.roles.some((role: any) => 
              role.roleid === 3 || role.roleid === 4 || 
              role.shortname?.includes('teacher') ||
              role.shortname?.includes('editingteacher')
            )
            
            if (hasTeacherRole) {
              console.log(`   ✅ ES PROFESOR en este curso`)
              isTeacherInAnyCourse = true
            } else {
              console.log(`   ❌ NO es profesor en este curso`)
            }
          } else {
            console.log(`   ⚠️ Usuario no encontrado en lista de usuarios del curso`)
          }
          
        } catch (error) {
          console.log(`   ❌ Error verificando curso: ${error}`)
        }
      }
      
      console.log(`\n📊 RESULTADO FINAL:`)
      if (isTeacherInAnyCourse) {
        console.log(`✅ El usuario ES PROFESOR en al menos un curso`)
        console.log(`✅ El login debería funcionar correctamente`)
      } else {
        console.log(`❌ El usuario NO es profesor en ningún curso verificado`)
        console.log(`💡 POSIBLES SOLUCIONES:`)
        console.log(`   1. Asignar rol de profesor en al menos un curso`)
        console.log(`   2. Verificar configuración de roles en Moodle`)
        console.log(`   3. Contactar administrador de Moodle`)
      }
      
    } else {
      console.log(`❌ No se obtuvo token. Respuesta:`, data)
    }
    
  } catch (error) {
    console.error(`❌ ERROR DURANTE DIAGNÓSTICO:`, error)
    console.log(`\n💡 POSIBLES CAUSAS:`)
    console.log(`   1. URL de Moodle incorrecta: ${process.env.MOODLE_URL}`)
    console.log(`   2. Moodle no accesible desde esta red`)
    console.log(`   3. Configuración de web services no habilitada`)
    console.log(`   4. Firewall bloqueando la conexión`)
  }
}

debugMoodleLogin().catch(console.error)