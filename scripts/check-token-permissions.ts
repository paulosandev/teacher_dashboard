#!/usr/bin/env npx tsx

/**
 * Script para verificar los permisos del token actual de Moodle
 * y explorar la implementación usando el token del profesor
 */

import dotenv from 'dotenv'
import path from 'path'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const MOODLE_API_URL = process.env.MOODLE_API_URL!
const MOODLE_API_TOKEN = process.env.MOODLE_API_TOKEN!

interface TokenInfo {
  token: string
  privatetoken?: string
  userid?: number
  username?: string
  firstname?: string
  lastname?: string
  fullname?: string
  email?: string
  capabilities?: string[]
}

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
 * Obtiene información sobre el usuario del token
 */
async function getTokenUserInfo(): Promise<any> {
  try {
    console.log('\n🔍 Obteniendo información del usuario del token...')
    
    // Obtener información del sitio y usuario actual
    const siteInfo = await callMoodleAPI('core_webservice_get_site_info')
    
    console.log('\n📋 Información del usuario del token:')
    console.log(`   User ID: ${siteInfo.userid}`)
    console.log(`   Username: ${siteInfo.username}`)
    console.log(`   Nombre completo: ${siteInfo.fullname}`)
    console.log(`   Email: ${siteInfo.userprivateaccesskey ? '(privado)' : siteInfo.email || 'No disponible'}`)
    console.log(`   Sitio: ${siteInfo.sitename}`)
    console.log(`   Rol del sitio: ${siteInfo.userissiteadmin ? 'Administrador' : 'Usuario regular'}`)
    
    // Verificar funciones disponibles
    if (siteInfo.functions) {
      console.log(`\n📚 Funciones disponibles: ${siteInfo.functions.length}`)
      
      // Buscar funciones relacionadas con tareas
      const assignFunctions = siteInfo.functions.filter((f: any) => 
        f.name.includes('assign')
      )
      console.log(`\n📝 Funciones de tareas (assign):`)
      assignFunctions.forEach((f: any) => {
        console.log(`   - ${f.name}`)
      })
      
      // Verificar específicamente mod_assign_get_submissions
      const hasSubmissionsAccess = siteInfo.functions.some((f: any) => 
        f.name === 'mod_assign_get_submissions'
      )
      console.log(`\n🔑 Acceso a mod_assign_get_submissions: ${hasSubmissionsAccess ? '✅ SÍ' : '❌ NO'}`)
      
      // Buscar funciones de roles
      const roleFunctions = siteInfo.functions.filter((f: any) => 
        f.name.includes('role') || f.name.includes('enrol')
      )
      console.log(`\n👥 Funciones de roles y matriculación:`)
      roleFunctions.forEach((f: any) => {
        console.log(`   - ${f.name}`)
      })
    }
    
    return siteInfo
  } catch (error) {
    console.error('❌ Error obteniendo información del token:', error)
    return null
  }
}

/**
 * Verifica los permisos en un curso específico
 */
async function checkCoursePermissions(courseId: number, userId: number): Promise<void> {
  console.log(`\n🔍 Verificando permisos en el curso ${courseId} para el usuario ${userId}...`)
  
  try {
    // Intentar obtener usuarios inscritos
    console.log('   Probando core_enrol_get_enrolled_users...')
    const enrolledUsers = await callMoodleAPI('core_enrol_get_enrolled_users', {
      courseid: courseId,
    })
    
    // Buscar al usuario del token
    const tokenUser = enrolledUsers.find((u: any) => u.id === userId)
    if (tokenUser) {
      console.log(`   ✅ Usuario encontrado en el curso`)
      console.log(`   Roles: ${tokenUser.roles?.map((r: any) => r.shortname).join(', ') || 'No especificados'}`)
    } else {
      console.log(`   ⚠️ Usuario NO encontrado en el curso`)
    }
    
    // Intentar obtener tareas del curso
    console.log('\n   Probando mod_assign_get_assignments...')
    try {
      const assignments = await callMoodleAPI('mod_assign_get_assignments', {
        courseids: [courseId],
      })
      console.log(`   ✅ Puede obtener tareas: ${assignments.courses?.[0]?.assignments?.length || 0} tareas encontradas`)
      
      // Si hay tareas, intentar obtener entregas
      if (assignments.courses?.[0]?.assignments?.length > 0) {
        const firstAssignment = assignments.courses[0].assignments[0]
        console.log(`\n   Probando mod_assign_get_submissions para tarea ${firstAssignment.id}...`)
        
        try {
          const submissions = await callMoodleAPI('mod_assign_get_submissions', {
            assignmentids: [firstAssignment.id],
          })
          console.log(`   ✅ Puede obtener entregas: ${submissions.assignments?.[0]?.submissions?.length || 0} entregas`)
        } catch (subError: any) {
          console.log(`   ❌ NO puede obtener entregas: ${subError.message}`)
        }
      }
    } catch (assignError: any) {
      console.log(`   ❌ NO puede obtener tareas: ${assignError.message}`)
    }
    
  } catch (error: any) {
    console.error(`❌ Error verificando permisos: ${error.message}`)
  }
}

/**
 * Propuesta de implementación con token del profesor
 */
function proposeTeacherTokenImplementation(): void {
  console.log('\n\n🎯 PROPUESTA DE IMPLEMENTACIÓN CON TOKEN DEL PROFESOR')
  console.log('='.repeat(60))
  
  console.log('\n1️⃣ MODELO DE BASE DE DATOS:')
  console.log(`
  // Agregar a schema.prisma
  model UserMoodleToken {
    id           String   @id @default(cuid())
    userId       String   @unique
    user         User     @relation(fields: [userId], references: [id])
    moodleToken  String   @db.Text // Encriptado
    moodleUserId Int?
    createdAt    DateTime @default(now())
    updatedAt    DateTime @updatedAt
    expiresAt    DateTime? // Si los tokens expiran
  }
  `)
  
  console.log('\n2️⃣ FLUJO DE AUTENTICACIÓN:')
  console.log(`
  a) En el login, solicitar también el token de Moodle del profesor
  b) Validar el token contra Moodle
  c) Almacenar el token encriptado en la base de datos
  d) Usar ese token para todas las operaciones del profesor
  `)
  
  console.log('\n3️⃣ CLIENTE API MODIFICADO:')
  console.log(`
  // lib/moodle/api-client.ts
  class MoodleAPIClient {
    private async getUserToken(userId: string): Promise<string> {
      // Obtener token del usuario de la BD
      const userToken = await prisma.userMoodleToken.findUnique({
        where: { userId }
      })
      
      if (!userToken) {
        throw new Error('Usuario no tiene token de Moodle configurado')
      }
      
      // Desencriptar y retornar
      return decrypt(userToken.moodleToken)
    }
    
    async callMoodleAPIAsUser(
      wsfunction: string, 
      params: Record<string, any>,
      userId: string
    ): Promise<any> {
      const userToken = await this.getUserToken(userId)
      // Usar userToken en lugar del token global
      // ...
    }
  }
  `)
  
  console.log('\n4️⃣ VENTAJAS:')
  console.log(`
  ✅ Cada profesor solo accede a SUS cursos y datos
  ✅ Permisos nativos de Moodle se respetan automáticamente
  ✅ No necesita permisos de administrador
  ✅ Más seguro y alineado con el modelo de seguridad de Moodle
  ✅ Permite operaciones específicas del profesor (calificar, ver entregas, etc.)
  `)
  
  console.log('\n5️⃣ DESVENTAJAS:')
  console.log(`
  ⚠️ Requiere que cada profesor proporcione su token
  ⚠️ Necesita manejo seguro de tokens (encriptación)
  ⚠️ Tokens pueden expirar y necesitar renovación
  ⚠️ Más complejidad en el flujo de autenticación
  `)
  
  console.log('\n6️⃣ ALTERNATIVA HÍBRIDA:')
  console.log(`
  🔄 Usar token de administrador para operaciones de lectura general
  🔄 Usar token del profesor para operaciones específicas (entregas, calificaciones)
  🔄 Cachear datos generales, consultar datos específicos en tiempo real
  `)
}

/**
 * Main
 */
async function main() {
  console.log('🔐 VERIFICACIÓN DE PERMISOS DEL TOKEN DE MOODLE')
  console.log('='.repeat(60))
  console.log(`URL: ${MOODLE_API_URL}`)
  console.log(`Token: ${MOODLE_API_TOKEN.substring(0, 8)}...`)
  
  // Obtener información del token
  const tokenInfo = await getTokenUserInfo()
  
  if (tokenInfo) {
    // Verificar permisos en un curso específico
    // Curso de ejemplo: 1686 (SEMINARIO DESARROLLO DE LA INTELIGENCIA II TET2 2024 OCTUBRE)
    await checkCoursePermissions(1686, tokenInfo.userid)
  }
  
  // Proponer implementación con token del profesor
  proposeTeacherTokenImplementation()
  
  console.log('\n\n✅ Verificación completada')
}

// Ejecutar
main().catch(console.error)
