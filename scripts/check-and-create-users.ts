#!/usr/bin/env npx tsx

/**
 * Script para verificar y crear usuarios necesarios para testing
 */

import dotenv from 'dotenv'
import path from 'path'
import { prisma } from '../lib/db/prisma'
import bcrypt from 'bcryptjs'

// Cargar variables de entorno
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function checkAndCreateUsers() {
  console.log('🔍 VERIFICANDO USUARIOS EN LA BASE DE DATOS')
  console.log('='.repeat(60))
  
  // Obtener todos los usuarios
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      name: true,
      matricula: true,
      createdAt: true
    }
  })
  
  console.log(`\n📊 Usuarios encontrados: ${users.length}`)
  console.log('-'.repeat(60))
  
  if (users.length > 0) {
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'Sin nombre'}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Username: ${user.username || 'Sin username'}`)
      console.log(`   Matrícula: ${user.matricula || 'Sin matrícula'}`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Creado: ${user.createdAt.toLocaleDateString()}`)
      console.log('')
    })
  }
  
  // Usuarios que deberían existir
  const requiredUsers = [
    {
      email: 'mail.paulo@gmail.com',
      username: 'paulo',
      name: 'Paulo Cesar',
      matricula: 'paulo.cesar', // Matrícula real en Moodle
      password: 'admin1234'
    },
    {
      email: 'cesar.espindola@utel.edu.mx',
      username: 'cesar', // Username simplificado
      name: 'César Espíndola',
      matricula: 'cesar.espindola', // Matrícula real en Moodle
      password: 'admin1234'
    }
  ]
  
  console.log('🔧 VERIFICANDO USUARIOS REQUERIDOS')
  console.log('='.repeat(60))
  
  for (const userData of requiredUsers) {
    console.log(`\n👤 Verificando usuario: ${userData.email}`)
    
    // Buscar por email o username
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userData.email },
          { username: userData.username }
        ]
      }
    })
    
    if (existingUser) {
      console.log(`   ✅ Usuario existe: ${existingUser.name}`)
      console.log(`   📧 Email: ${existingUser.email}`)
      console.log(`   🔑 Username: ${existingUser.username}`)
      
      // Verificar password
      try {
        const passwordMatch = await bcrypt.compare(userData.password, existingUser.password)
        if (passwordMatch) {
          console.log(`   🔓 Password correcto: ✅`)
        } else {
          console.log(`   🔒 Password incorrecto: ❌`)
          console.log(`   🔧 Actualizando password...`)
          
          const hashedPassword = await bcrypt.hash(userData.password, 10)
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { password: hashedPassword }
          })
          
          console.log(`   ✅ Password actualizado`)
        }
      } catch (error) {
        console.log(`   ❌ Error verificando password:`, error)
      }
      
    } else {
      console.log(`   ❌ Usuario NO existe. Creando...`)
      
      try {
        const hashedPassword = await bcrypt.hash(userData.password, 10)
        
        const newUser = await prisma.user.create({
          data: {
            email: userData.email,
            username: userData.username,
            name: userData.name,
            matricula: userData.matricula,
            password: hashedPassword
          }
        })
        
        console.log(`   ✅ Usuario creado exitosamente`)
        console.log(`   📧 Email: ${newUser.email}`)
        console.log(`   🔑 Username: ${newUser.username}`)
        console.log(`   🆔 ID: ${newUser.id}`)
        
      } catch (error: any) {
        console.log(`   ❌ Error creando usuario:`, error.message)
      }
    }
  }
  
  console.log('\n🔍 CREDENCIALES PARA LOGIN')
  console.log('='.repeat(60))
  console.log('📧 mail.paulo@gmail.com')
  console.log('🔑 admin1234')
  console.log('')
  console.log('📧 cesar.espindola@utel.edu.mx') 
  console.log('🔑 admin1234')
  console.log('')
  console.log('También puedes usar los usernames:')
  console.log('👤 paulo / admin1234')
  console.log('👤 cesar.espindola / admin1234')
  
  console.log('\n✅ Verificación completada')
}

// Ejecutar
checkAndCreateUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
