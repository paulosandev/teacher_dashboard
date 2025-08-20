/**
 * Script para generar token de julioprofe desde Moodle
 */

import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config()

async function getJulioprofeToken() {
  console.log('🔑 Generando token para julioprofe...')
  
  const moodleUrl = process.env.MOODLE_URL!
  const loginUrl = `${moodleUrl}/login/token.php`
  
  const params = new URLSearchParams({
    username: 'julioprofe',
    password: 'admin1234',
    service: 'moodle_mobile_app'
  })
  
  try {
    console.log(`📡 Llamando: ${loginUrl}`)
    console.log(`👤 Usuario: julioprofe`)
    
    const response = await fetch(loginUrl, {
      method: 'POST',
      body: params,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
    
    const result = await response.text()
    console.log(`📝 Respuesta completa:`, result)
    
    if (result.includes('token')) {
      const tokenData = JSON.parse(result)
      console.log(`✅ Token generado exitosamente:`)
      console.log(`🔑 Token: ${tokenData.token}`)
      console.log(`🆔 Usuario ID: ${tokenData.userid || 'No disponible'}`)
      console.log(`📅 Expira: ${tokenData.timemodified ? new Date(tokenData.timemodified * 1000).toLocaleString() : 'No disponible'}`)
      
      return tokenData.token
    } else {
      console.error('❌ No se pudo generar el token')
      console.log('Respuesta:', result)
      return null
    }
    
  } catch (error) {
    console.error('❌ Error generando token:', error)
    return null
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  getJulioprofeToken().catch(console.error)
}

export { getJulioprofeToken }