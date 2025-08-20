// Script para investigar el problema de tokens incorrectos
import { PrismaClient } from '@prisma/client'
import { decrypt } from '../lib/utils/encryption'
import { MoodleAPIClient } from '../lib/moodle/api-client'

const prisma = new PrismaClient()

async function investigateTokenMismatch() {
  console.log('🔍 Investigando problema de tokens incorrectos')
  
  try {
    // 1. Verificar todos los tokens almacenados
    console.log('\n📋 Tokens almacenados en base de datos:')
    const allTokens = await prisma.userMoodleToken.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            matricula: true
          }
        }
      }
    })
    
    console.log(`\n📊 Total tokens encontrados: ${allTokens.length}`)
    
    for (const tokenRecord of allTokens) {
      console.log(`\n👤 Token para usuario: ${tokenRecord.user.name}`)
      console.log(`   ID Local: ${tokenRecord.user.id}`)
      console.log(`   Matrícula: ${tokenRecord.user.matricula}`)
      console.log(`   Email: ${tokenRecord.user.email}`)
      console.log(`   Username: ${tokenRecord.user.username}`)
      console.log(`   Token creado: ${tokenRecord.createdAt}`)
      console.log(`   Token actualizado: ${tokenRecord.updatedAt}`)
      console.log(`   Activo: ${tokenRecord.isActive}`)
      console.log(`   Moodle User ID: ${tokenRecord.moodleUserId || 'No definido'}`)
      console.log(`   Moodle Username: ${tokenRecord.moodleUsername || 'No definido'}`)
      
      // Verificar a qué usuario pertenece realmente el token
      try {
        const decryptedToken = decrypt(tokenRecord.token)
        console.log(`   Token cifrado: ${tokenRecord.token.substring(0, 30)}...`)
        
        // Crear cliente temporal para verificar token
        const tempClient = new MoodleAPIClient(
          process.env.MOODLE_URL!,
          decryptedToken
        )
        
        // Obtener información real del usuario del token
        const userInfo = await tempClient.callMoodleAPI('core_webservice_get_site_info', {})
        
        console.log(`   🔍 REAL usuario del token:`)
        console.log(`      Username: ${userInfo.username}`)
        console.log(`      Nombre: ${userInfo.fullname}`)
        console.log(`      User ID: ${userInfo.userid}`)
        console.log(`      Sitio: ${userInfo.sitename}`)
        
        // Verificar si coincide con el usuario esperado
        const isCorrect = userInfo.username === tokenRecord.user.matricula
        console.log(`   ${isCorrect ? '✅' : '❌'} Token coincide: ${isCorrect ? 'SÍ' : 'NO'}`)
        
        if (!isCorrect) {
          console.log(`   ⚠️  PROBLEMA: Token asignado a ${tokenRecord.user.matricula} pero pertenece a ${userInfo.username}`)
        }
        
      } catch (tokenError) {
        console.log(`   ❌ Error verificando token: ${tokenError}`)
      }
    }
    
    // 2. Verificar si hay duplicación de tokens
    console.log('\n🔍 Buscando duplicaciones...')
    const userCounts = {}
    const moodleUserCounts = {}
    
    allTokens.forEach(token => {
      const matricula = token.user.matricula
      userCounts[matricula] = (userCounts[matricula] || 0) + 1
      
      if (token.moodleUsername) {
        moodleUserCounts[token.moodleUsername] = (moodleUserCounts[token.moodleUsername] || 0) + 1
      }
    })
    
    console.log('\n👥 Tokens por matrícula:')
    Object.entries(userCounts).forEach(([matricula, count]) => {
      console.log(`   ${matricula}: ${count} ${count > 1 ? '❌ DUPLICADO' : '✅'}`)
    })
    
    console.log('\n👥 Tokens por usuario Moodle:')
    Object.entries(moodleUserCounts).forEach(([username, count]) => {
      console.log(`   ${username}: ${count} ${count > 1 ? '❌ DUPLICADO' : '✅'}`)
    })
    
    // 3. Verificar usuario específico cesar.espindola
    console.log('\n🎯 Análisis específico de cesar.espindola:')
    const cesarTokens = allTokens.filter(t => t.user.matricula === 'cesar.espindola')
    
    if (cesarTokens.length === 0) {
      console.log('   ❌ No se encontró token para cesar.espindola')
    } else {
      console.log(`   📊 Tokens encontrados: ${cesarTokens.length}`)
      
      for (const cesarToken of cesarTokens) {
        try {
          const decryptedToken = decrypt(cesarToken.token)
          const tempClient = new MoodleAPIClient(
            process.env.MOODLE_URL!,
            decryptedToken
          )
          
          const userInfo = await tempClient.callMoodleAPI('core_webservice_get_site_info', {})
          console.log(`   🔍 Token de cesar.espindola apunta a: ${userInfo.username} (${userInfo.fullname})`)
          
          if (userInfo.username !== 'cesar.espindola') {
            console.log(`   🚨 PROBLEMA CONFIRMADO: Token apunta a ${userInfo.username} en lugar de cesar.espindola`)
            
            // Verificar si este token corresponde a otro usuario en nuestra BD
            const realOwner = allTokens.find(t => t.moodleUsername === userInfo.username)
            if (realOwner) {
              console.log(`   💡 Este token debería pertenecer a: ${realOwner.user.name} (${realOwner.user.matricula})`)
            }
          }
          
        } catch (error) {
          console.log(`   ❌ Error verificando token de cesar: ${error}`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error durante investigación:', error)
  } finally {
    await prisma.$disconnect()
  }
}

investigateTokenMismatch().catch(console.error)