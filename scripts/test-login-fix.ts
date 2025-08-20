// Test script para verificar que el fix de login funciona correctamente
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testLoginFix() {
  console.log('🧪 Testing Login Fix - Matrícula no debe ser undefined')
  
  try {
    // 1. Verificar que los usuarios existen y tienen matrícula
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        matricula: true,
        name: true
      }
    })
    
    console.log('\n📋 Usuarios en la base de datos:')
    users.forEach(user => {
      console.log(`  • ${user.name}`)
      console.log(`    Email: ${user.email}`)
      console.log(`    Username: ${user.username}`)
      console.log(`    Matrícula: ${user.matricula} ${user.matricula ? '✅' : '❌ UNDEFINED!'}`)
      console.log('')
    })
    
    // 2. Test búsqueda por email
    console.log('🔍 Test: Búsqueda por email')
    const userByEmail = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'cesar.espindola@utel.edu.mx'.toLowerCase() },
          { username: 'cesar.espindola@utel.edu.mx'.toLowerCase() },
          { matricula: 'cesar.espindola@utel.edu.mx'.toLowerCase() }
        ]
      }
    })
    
    if (userByEmail) {
      console.log(`  ✅ Usuario encontrado: ${userByEmail.name} (${userByEmail.matricula})`)
    } else {
      console.log('  ❌ Usuario no encontrado por email')
    }
    
    // 3. Test búsqueda por matrícula
    console.log('\n🔍 Test: Búsqueda por matrícula')
    const userByMatricula = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'cesar.espindola'.toLowerCase() },
          { username: 'cesar.espindola'.toLowerCase() },
          { matricula: 'cesar.espindola'.toLowerCase() }
        ]
      }
    })
    
    if (userByMatricula) {
      console.log(`  ✅ Usuario encontrado: ${userByMatricula.name} (${userByMatricula.matricula})`)
    } else {
      console.log('  ❌ Usuario no encontrado por matrícula')
    }
    
    // 4. Test búsqueda por username
    console.log('\n🔍 Test: Búsqueda por username')
    const userByUsername = await prisma.user.findFirst({
      where: {
        OR: [
          { email: 'paulo.cesar'.toLowerCase() },
          { username: 'paulo.cesar'.toLowerCase() },
          { matricula: 'paulo.cesar'.toLowerCase() }
        ]
      }
    })
    
    if (userByUsername) {
      console.log(`  ✅ Usuario encontrado: ${userByUsername.name} (${userByUsername.matricula})`)
    } else {
      console.log('  ❌ Usuario no encontrado por username')
    }
    
    // 5. Test contraseña
    console.log('\n🔒 Test: Verificación de contraseña')
    if (userByUsername) {
      const isPasswordValid = await bcrypt.compare('admin1234', userByUsername.password)
      console.log(`  ${isPasswordValid ? '✅' : '❌'} Contraseña ${isPasswordValid ? 'correcta' : 'incorrecta'}`)
    }
    
    // 6. Verificar que no hay matrículas vacías (si matricula es required, esto no debería pasar)
    console.log('\n⚠️  Verificación de integridad de datos:')
    console.log(`  ✅ Total usuarios: ${users.length}`)
    console.log(`  ✅ Todos tienen matrícula definida: ${users.every(u => u.matricula && u.matricula.trim() !== '') ? 'SÍ' : 'NO'}`)
    
    console.log('\n✅ Test completado')
    
  } catch (error) {
    console.error('❌ Error durante el test:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testLoginFix().catch(console.error)