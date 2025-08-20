// Script para crear el usuario Paulo César para testing
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createTestUser() {
  console.log('🔧 Creando usuario Paulo César para testing...')
  
  try {
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash('admin1234', 12)
    
    // Verificar si ya existe
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'mail.paulo@gmail.com' },
          { username: 'paulo.cesar' },
          { matricula: 'paulo.cesar' }
        ]
      }
    })
    
    if (existingUser) {
      console.log('✅ Usuario Paulo César ya existe')
      console.log(`   Nombre: ${existingUser.name}`)
      console.log(`   Email: ${existingUser.email}`)
      console.log(`   Username: ${existingUser.username}`)
      console.log(`   Matrícula: ${existingUser.matricula}`)
      return
    }
    
    // Crear el usuario
    const user = await prisma.user.create({
      data: {
        email: 'mail.paulo@gmail.com',
        username: 'paulo.cesar',
        password: hashedPassword,
        matricula: 'paulo.cesar',
        name: 'Paulo César',
      }
    })
    
    console.log('✅ Usuario Paulo César creado exitosamente:')
    console.log(`   ID: ${user.id}`)
    console.log(`   Nombre: ${user.name}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Username: ${user.username}`)
    console.log(`   Matrícula: ${user.matricula}`)
    
  } catch (error) {
    console.error('❌ Error creando usuario:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser().catch(console.error)