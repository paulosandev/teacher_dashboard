// Test simple para verificar el authorize function
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function testSimpleAuth() {
  console.log('🧪 Testing Simple Auth Function')
  
  const credentials = {
    login: 'cesar.espindola',
    password: 'admin1234'
  }
  
  try {
    console.log(`\n🔍 Buscando usuario con login: "${credentials.login}"`)
    
    // Replicar la lógica del authorize function
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: credentials.login.toLowerCase() },
          { username: credentials.login.toLowerCase() },
          { matricula: credentials.login.toLowerCase() }
        ]
      }
    })
    
    if (user) {
      console.log('✅ Usuario encontrado:')
      console.log(`   ID: ${user.id}`)
      console.log(`   Nombre: ${user.name}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Username: ${user.username}`)
      console.log(`   Matrícula: ${user.matricula}`)
      
      // Verificar contraseña
      console.log('\n🔒 Verificando contraseña...')
      const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
      
      if (isPasswordValid) {
        console.log('✅ Contraseña correcta')
        
        // Mostrar lo que retornaríamos
        const result = {
          id: user.id,
          email: user.email,
          name: user.name,
          matricula: user.matricula,
          username: user.username
        }
        
        console.log('\n📋 Objeto que se retornaría:')
        console.log(JSON.stringify(result, null, 2))
        
      } else {
        console.log('❌ Contraseña incorrecta')
      }
      
    } else {
      console.log('❌ Usuario no encontrado')
      
      // Debug: ver qué usuarios existen
      const allUsers = await prisma.user.findMany({
        select: { email: true, username: true, matricula: true, name: true }
      })
      
      console.log('\n📋 Usuarios disponibles:')
      allUsers.forEach(u => {
        console.log(`  • ${u.name}: email="${u.email}", username="${u.username}", matricula="${u.matricula}"`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testSimpleAuth().catch(console.error)