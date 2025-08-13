#!/usr/bin/env tsx

/**
 * Script para depurar el problema del filtrado de roles
 */

import { prisma } from '@/lib/db/prisma'

async function main() {
  console.log('🔍 DEBUG: Verificando problema de filtrado de roles')
  console.log('=' .repeat(60))

  // 1. Verificar qué usuario está en la sesión
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      matricula: true,
      name: true,
      email: true
    }
  })

  console.log('\n📋 USUARIOS EN BASE DE DATOS:')
  users.forEach(user => {
    console.log(`  - ${user.name} (${user.username}) - Matrícula: ${user.matricula}`)
  })

  // 2. Verificar sesiones activas
  const sessions = await prisma.session.findMany({
    include: {
      user: true
    },
    orderBy: {
      expires: 'desc'
    },
    take: 5
  })

  console.log('\n🔐 SESIONES ACTIVAS:')
  sessions.forEach(session => {
    const isExpired = new Date(session.expires) < new Date()
    console.log(`  - Usuario: ${session.user.name} (${session.user.matricula})`)
    console.log(`    Token: ${session.sessionToken.substring(0, 20)}...`)
    console.log(`    Expira: ${session.expires} ${isExpired ? '❌ EXPIRADA' : '✅ ACTIVA'}`)
  })

  // 3. Verificar el mapeo local en el cliente Moodle
  console.log('\n🗺️ MAPEO LOCAL DE USUARIOS EN MOODLE CLIENT:')
  
  const testMatriculas = [
    'cesar.espindola',
    'MAT001',
    'marco.arce'
  ]

  const { moodleClient } = await import('@/lib/moodle/api-client')
  
  for (const matricula of testMatriculas) {
    try {
      const moodleUser = await (moodleClient as any).getUserByUsername(matricula)
      if (moodleUser) {
        console.log(`  ✅ ${matricula} → Moodle ID: ${moodleUser.id} (${moodleUser.email})`)
      } else {
        console.log(`  ❌ ${matricula} → No encontrado`)
      }
    } catch (error) {
      console.log(`  ❌ ${matricula} → Error: ${error}`)
    }
  }

  // 4. Verificar la lógica de filtrado para César
  console.log('\n🧪 VERIFICANDO FILTRO PARA CÉSAR ESPÍNDOLA:')
  
  const cesarUser = users.find(u => u.username === 'cesar.espindola')
  if (cesarUser) {
    console.log(`\nUsuario: ${cesarUser.name}`)
    console.log(`Matrícula que se usa: ${cesarUser.matricula}`)
    
    const moodleUser = await (moodleClient as any).getUserByUsername(cesarUser.matricula)
    if (moodleUser) {
      console.log(`Moodle ID encontrado: ${moodleUser.id}`)
      
      // Obtener cursos directamente
      console.log('\n📚 Obteniendo cursos de César...')
      const courses = await (moodleClient as any).callMoodleAPI('core_enrol_get_users_courses', {
        userid: moodleUser.id
      })
      
      console.log(`Total cursos donde está inscrito: ${courses.length}`)
      
      // Verificar roles en cada curso
      console.log('\n🎭 VERIFICANDO ROLES EN CADA CURSO:')
      for (const course of courses) {
        console.log(`\n  Curso: ${course.fullname} (${course.shortname})`)
        
        try {
          const enrolledUsers = await (moodleClient as any).callMoodleAPI('core_enrol_get_enrolled_users', {
            courseid: course.id
          })
          
          const cesarInCourse = enrolledUsers.find((u: any) => u.id === moodleUser.id)
          
          if (cesarInCourse && cesarInCourse.roles) {
            console.log(`    Roles encontrados:`)
            cesarInCourse.roles.forEach((role: any) => {
              const isTeacher = [1, 3, 4, 17].includes(role.roleid)
              console.log(`      - ${role.shortname || role.name} (ID: ${role.roleid}) ${isTeacher ? '✅ PROFESOR' : '👨‍🎓 ESTUDIANTE'}`)
            })
          } else {
            console.log(`    ⚠️ Sin roles encontrados`)
          }
        } catch (error) {
          console.log(`    ❌ Error obteniendo roles: ${error}`)
        }
      }
    }
  }

  console.log('\n' + '=' .repeat(60))
  console.log('🔍 FIN DEL DEBUG')
}

main()
  .catch((error) => {
    console.error('💥 Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
