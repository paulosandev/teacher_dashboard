#!/usr/bin/env tsx

/**
 * Script para crear usuario Marco Arce con matrícula real de Moodle
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🚀 Creando usuario Marco Arce...')

  try {
    // Verificar si el usuario ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: 'marco.arce@utel.edu.mx' }
    })

    if (existingUser) {
      console.log('⚠️  Usuario Marco Arce ya existe, actualizando...')
      
      // Actualizar usuario existente
      const updatedUser = await prisma.user.update({
        where: { email: 'marco.arce@utel.edu.mx' },
        data: {
          matricula: 'marco.arce', // Matrícula real de Moodle
          username: 'marco.arce',
          name: 'Marco Arce',
          // Mantener la contraseña existente
        }
      })

      console.log('✅ Usuario actualizado exitosamente:')
      console.log(`   ID: ${updatedUser.id}`)
      console.log(`   Email: ${updatedUser.email}`)
      console.log(`   Matrícula: ${updatedUser.matricula}`)
      console.log(`   Username: ${updatedUser.username}`)
    } else {
      // Crear nuevo usuario
      const hashedPassword = await bcrypt.hash('password123', 12)

      const newUser = await prisma.user.create({
        data: {
          email: 'marco.arce@utel.edu.mx',
          matricula: 'marco.arce', // Matrícula real que existe en Moodle
          username: 'marco.arce',
          name: 'Marco Arce',
          password: hashedPassword,
        }
      })

      console.log('✅ Usuario creado exitosamente:')
      console.log(`   ID: ${newUser.id}`)
      console.log(`   Email: ${newUser.email}`)
      console.log(`   Matrícula: ${newUser.matricula}`)
      console.log(`   Username: ${newUser.username}`)
      console.log(`   Contraseña: password123`)
    }

    console.log('\n📋 Datos para login:')
    console.log('   Email: marco.arce@utel.edu.mx')
    console.log('   Matrícula: marco.arce')
    console.log('   Contraseña: password123')

  } catch (error) {
    console.error('❌ Error creando usuario:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
