import { PrismaClient } from '@prisma/client'
import { hash } from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  try {
    // Hash the password
    const hashedPassword = await hash('admin1234', 10)
    
    // Create or update the user
    const user = await prisma.user.upsert({
      where: {
        email: 'cesar.espindola@utel.edu.mx'
      },
      update: {
        password: hashedPassword,
        matricula: 'cesar.espindola',
        username: 'cesar.espindola',
        name: 'César Espíndola'
      },
      create: {
        email: 'cesar.espindola@utel.edu.mx',
        password: hashedPassword,
        matricula: 'cesar.espindola',
        username: 'cesar.espindola',
        name: 'César Espíndola'
      }
    })
    
    console.log('✅ Usuario creado/actualizado:', user)
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
