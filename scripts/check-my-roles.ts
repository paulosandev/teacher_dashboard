#!/usr/bin/env tsx

/**
 * Script para verificar los roles del usuario actual en cada curso de Moodle
 */

import { prisma } from '@/lib/db/prisma'
import { moodleClient } from '@/lib/moodle/api-client'

async function main() {
  console.log('🔍 VERIFICACIÓN DE ROLES EN MOODLE')
  console.log('=' .repeat(60))

  // Buscar usuario César Espíndola
  const user = await prisma.user.findUnique({
    where: { username: 'cesar.espindola' },
    include: {
      courses: true
    }
  })

  if (!user) {
    console.log('❌ Usuario no encontrado')
    return
  }

  console.log(`👤 Usuario: ${user.name} (${user.matricula})`)
  console.log(`📧 Email: ${user.email}`)
  console.log('')

  // Obtener información del usuario en Moodle
  console.log('🔍 Buscando usuario en Moodle...')
  const moodleUser = await (moodleClient as any).getUserByUsername(user.matricula)
  
  if (!moodleUser) {
    console.log('❌ Usuario no encontrado en Moodle')
    return
  }

  console.log(`✅ Usuario Moodle ID: ${moodleUser.id}`)
  console.log('')

  // Obtener TODOS los cursos donde está inscrito
  console.log('📚 OBTENIENDO TODOS LOS CURSOS DONDE ESTÁS INSCRITO...')
  const allCourses = await (moodleClient as any).callMoodleAPI('core_enrol_get_users_courses', {
    userid: moodleUser.id,
  })

  console.log(`📊 Total de cursos donde estás inscrito: ${allCourses.length}`)
  console.log('')

  // Analizar cada curso individualmente
  console.log('🔎 ANALIZANDO ROLES EN CADA CURSO:')
  console.log('-'.repeat(60))
  
  let teacherCount = 0
  let studentCount = 0
  const teacherCourses = []
  const studentCourses = []

  for (let i = 0; i < allCourses.length; i++) {
    const course = allCourses[i]
    console.log(`\n[${i+1}/${allCourses.length}] ${course.fullname}`)
    console.log(`   📌 ID: ${course.id} | Código: ${course.shortname}`)
    
    try {
      // Obtener usuarios del curso para ver roles
      const enrolledUsers = await (moodleClient as any).callMoodleAPI('core_enrol_get_enrolled_users', {
        courseid: course.id
      })
      
      // Buscar nuestro usuario específico
      const ourUser = enrolledUsers.find((u: any) => u.id === moodleUser.id)
      
      if (ourUser && ourUser.roles) {
        console.log(`   🎭 Tus roles en este curso:`)
        
        let isTeacher = false
        ourUser.roles.forEach((role: any) => {
          const roleType = getRoleType(role.roleid, role.shortname || role.name)
          console.log(`      - ${role.shortname || role.name} (ID: ${role.roleid}) → ${roleType}`)
          
          if (roleType === 'PROFESOR') {
            isTeacher = true
          }
        })
        
        if (isTeacher) {
          console.log(`   ✅ ERES PROFESOR`)
          teacherCount++
          teacherCourses.push({
            id: course.id,
            name: course.fullname,
            shortname: course.shortname
          })
        } else {
          console.log(`   👨‍🎓 ERES ESTUDIANTE`)
          studentCount++
          studentCourses.push({
            id: course.id,
            name: course.fullname,
            shortname: course.shortname
          })
        }
      } else {
        console.log(`   ⚠️ No se encontraron roles`)
      }
      
    } catch (error) {
      console.log(`   ❌ Error obteniendo roles: ${error instanceof Error ? error.message : error}`)
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60))
  console.log('📊 RESUMEN DE ROLES:')
  console.log('='.repeat(60))
  console.log(`\n✅ CURSOS DONDE ERES PROFESOR: ${teacherCount}`)
  teacherCourses.forEach(course => {
    console.log(`   - ${course.name} (${course.shortname})`)
  })
  
  console.log(`\n👨‍🎓 CURSOS DONDE ERES ESTUDIANTE: ${studentCount}`)
  studentCourses.forEach(course => {
    console.log(`   - ${course.name} (${course.shortname})`)
  })

  // Verificar qué está devolviendo el método getTeacherCoursesWithGroups
  console.log('\n' + '='.repeat(60))
  console.log('🧪 PROBANDO MÉTODO getTeacherCoursesWithGroups:')
  console.log('='.repeat(60))
  
  const filteredCourses = await moodleClient.getTeacherCoursesWithGroups(user.matricula)
  console.log(`\n📤 El método devuelve ${filteredCourses.length} cursos`)
  
  if (filteredCourses.length !== teacherCount) {
    console.log(`\n⚠️ DISCREPANCIA DETECTADA!`)
    console.log(`   - Esperados (profesor): ${teacherCount}`)
    console.log(`   - Devueltos por método: ${filteredCourses.length}`)
    console.log(`\n🔍 Cursos devueltos por el método:`)
    filteredCourses.forEach(course => {
      console.log(`   - ${course.name} (ID: ${course.id})`)
    })
  } else {
    console.log(`✅ El filtro está funcionando correctamente`)
  }
}

function getRoleType(roleId: number, roleName: string): string {
  const name = roleName.toLowerCase()
  
  // IDs conocidos de roles de profesor
  if (roleId === 1 || roleId === 3 || roleId === 4 || roleId === 17) {
    return 'PROFESOR'
  }
  
  // ID conocido de estudiante
  if (roleId === 5) {
    return 'ESTUDIANTE'
  }
  
  // Verificar por nombre
  if (name.includes('teacher') || 
      name.includes('profesor') || 
      name.includes('editor') || 
      name.includes('manager') ||
      name.includes('tutor')) {
    return 'PROFESOR'
  }
  
  if (name.includes('student') || name.includes('alumno') || name.includes('estudiante')) {
    return 'ESTUDIANTE'
  }
  
  return 'DESCONOCIDO'
}

main()
  .catch((error) => {
    console.error('💥 Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
