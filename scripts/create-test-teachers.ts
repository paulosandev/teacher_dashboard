#!/usr/bin/env tsx

/**
 * Script para crear múltiples profesores de prueba y añadir sus IDs reales
 */

// Cargar variables de entorno
import dotenv from 'dotenv'
dotenv.config()

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { moodleClient } from '../lib/moodle/api-client'

const prisma = new PrismaClient()

const testTeachers = [
  {
    name: 'Marco Arce',
    email: 'marco.arce@utel.edu.mx',
    matricula: 'marco.arce',
    password: 'password123'
  },
  {
    name: 'Ana García',
    email: 'ana.garcia@utel.edu.mx',
    matricula: 'ana.garcia',
    password: 'password123'
  },
  {
    name: 'Carlos López',
    email: 'carlos.lopez@utel.edu.mx',
    matricula: 'carlos.lopez',
    password: 'password123'
  }
]

async function createTeachersInDB() {
  console.log('🚀 Creando profesores de prueba en la base de datos...\n')

  for (const teacher of testTeachers) {
    try {
      // Verificar si el usuario ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: teacher.email }
      })

      if (existingUser) {
        console.log(`⚠️  Usuario ${teacher.name} ya existe, actualizando...`)
        
        await prisma.user.update({
          where: { email: teacher.email },
          data: {
            matricula: teacher.matricula,
            username: teacher.matricula,
            name: teacher.name,
          }
        })
      } else {
        // Crear nuevo usuario
        const hashedPassword = await bcrypt.hash(teacher.password, 12)

        await prisma.user.create({
          data: {
            email: teacher.email,
            matricula: teacher.matricula,
            username: teacher.matricula,
            name: teacher.name,
            password: hashedPassword,
          }
        })

        console.log(`✅ Usuario ${teacher.name} creado exitosamente`)
      }
    } catch (error) {
      console.error(`❌ Error creando usuario ${teacher.name}:`, error)
    }
  }
}

async function findTeacherIDsInMoodle() {
  console.log('\n🔍 Buscando IDs reales de profesores en Moodle...\n')

  const foundTeachers: Array<{matricula: string, id: number, email: string}> = []

  for (const teacher of testTeachers) {
    try {
      console.log(`🔎 Buscando ${teacher.matricula} en Moodle...`)
      
      // Usar la API para buscar el usuario
      const moodleUser = await moodleClient.getUserByUsername(teacher.matricula)
      
      if (moodleUser) {
        console.log(`✅ ${teacher.name}: ID ${moodleUser.id}, Email: ${moodleUser.email}`)
        foundTeachers.push({
          matricula: teacher.matricula,
          id: moodleUser.id,
          email: moodleUser.email
        })
      } else {
        console.log(`❌ ${teacher.name}: No encontrado en Moodle`)
      }
      
    } catch (error) {
      console.error(`❌ Error buscando ${teacher.name}:`, error)
    }
  }

  if (foundTeachers.length > 0) {
    console.log('\n📋 MAPEO PARA ACTUALIZAR EN api-client.ts:')
    console.log('```typescript')
    foundTeachers.forEach(teacher => {
      console.log(`'${teacher.matricula}': { id: ${teacher.id}, username: '${teacher.matricula}', email: '${teacher.email}' },`)
    })
    console.log('```\n')
  }

  return foundTeachers
}

async function main() {
  try {
    // Paso 1: Crear usuarios en la base de datos local
    await createTeachersInDB()
    
    // Paso 2: Buscar sus IDs reales en Moodle
    const foundTeachers = await findTeacherIDsInMoodle()
    
    console.log('\n🎯 RESUMEN:')
    console.log(`• Profesores creados en DB local: ${testTeachers.length}`)
    console.log(`• Profesores encontrados en Moodle: ${foundTeachers.length}`)
    
    if (foundTeachers.length > 0) {
      console.log('\n📝 PRÓXIMO PASO:')
      console.log('Actualiza el método getMoodleUserMapping() en lib/moodle/api-client.ts')
      console.log('con los IDs reales mostrados arriba.')
    }

  } catch (error) {
    console.error('❌ Error durante la ejecución:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
