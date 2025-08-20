// Test para verificar que la sesión incluya la matrícula correctamente
import { getServerSession } from 'next-auth'
import { authOptions } from '../lib/auth/auth-options'

// Simulamos el proceso de autenticación
async function testAuthSession() {
  console.log('🧪 Testing Auth Session - Verificar matrícula en sesión')
  
  try {
    // Simulamos que tenemos las credenciales correctas
    const credentials = {
      login: 'cesar.espindola',
      password: 'admin1234'
    }
    
    console.log(`\n🔐 Simulando login con: "${credentials.login}"`)
    
    // El authorize function de authOptions debería encontrar al usuario
    const provider = authOptions.providers[0] as any
    const user = await provider.authorize(credentials)
    
    if (user) {
      console.log('✅ Usuario autenticado exitosamente:')
      console.log(`   ID: ${user.id}`)
      console.log(`   Nombre: ${user.name}`)
      console.log(`   Email: ${user.email}`)
      console.log(`   Matrícula: ${user.matricula} ${user.matricula ? '✅' : '❌ UNDEFINED!'}`)
      console.log(`   Username: ${user.username}`)
      
      // Simular el callback JWT
      const jwtCallback = authOptions.callbacks?.jwt
      if (jwtCallback) {
        const token = await jwtCallback({ token: {}, user })
        
        console.log('\n🎫 Token JWT generado:')
        console.log(`   ID: ${token.id}`)
        console.log(`   Email: ${token.email}`)
        console.log(`   Matrícula: ${token.matricula} ${token.matricula ? '✅' : '❌ UNDEFINED!'}`)
        
        // Simular el callback de sesión
        const sessionCallback = authOptions.callbacks?.session
        if (sessionCallback) {
          const session = await sessionCallback({
            session: { user: {} as any },
            token
          })
          
          console.log('\n👤 Sesión final:')
          console.log(`   ID: ${session.user.id}`)
          console.log(`   Nombre: ${session.user.name}`)
          console.log(`   Email: ${session.user.email}`)
          console.log(`   Matrícula: ${session.user.matricula} ${session.user.matricula ? '✅' : '❌ UNDEFINED!'}`)
          console.log(`   Username: ${session.user.username}`)
          
          // Verificar que no haya campos undefined
          const hasUndefined = Object.entries(session.user).some(([key, value]) => 
            value === undefined && key !== 'name' // name puede ser null
          )
          
          if (hasUndefined) {
            console.log('\n❌ ERROR: Algunos campos de la sesión son undefined')
          } else {
            console.log('\n✅ SUCCESS: Todos los campos requeridos están definidos')
          }
          
        } else {
          console.log('❌ No se encontró el callback de sesión')
        }
      } else {
        console.log('❌ No se encontró el callback JWT')
      }
      
    } else {
      console.log('❌ Fallo en la autenticación')
    }
    
    // Test con matrícula diferentes casos
    console.log('\n🔄 Testing diferentes formas de login...')
    
    const testCases = [
      { login: 'cesar.espindola', description: 'Por matrícula' },
      { login: 'cesar.espindola@utel.edu.mx', description: 'Por email' },
      { login: 'paulo.cesar', description: 'Por matrícula paulo' },
      { login: 'mail.paulo@gmail.com', description: 'Por email paulo' }
    ]
    
    for (const testCase of testCases) {
      const user = await provider.authorize({
        login: testCase.login,
        password: 'admin1234'
      })
      
      console.log(`  ${testCase.description}: ${user ? '✅' : '❌'} ${user ? `(${user.matricula})` : ''}`)
    }
    
  } catch (error) {
    console.error('❌ Error durante el test:', error)
  }
}

testAuthSession().catch(console.error)