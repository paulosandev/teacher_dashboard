import { MoodleAuthService } from '../lib/moodle/auth-service'

async function main() {
  const authService = new MoodleAuthService()
  
  console.log('Probando autenticación con credenciales de César...')
  
  const result = await authService.authenticateWithCredentials(
    'test-user-id',
    'cesar.espindola',
    'admin1234'
  )
  
  console.log('Resultado:', result)
}

main().catch(console.error)
