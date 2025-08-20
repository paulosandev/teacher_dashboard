import { PrismaClient } from '@prisma/client';
import { MoodleAuthService } from '../lib/moodle/auth-service';

const prisma = new PrismaClient();

async function testAutomaticTokenGeneration() {
  console.log('='.repeat(60));
  console.log('TEST: Generación Automática de Tokens de Moodle');
  console.log('='.repeat(60));

  try {
    // 1. Buscar un usuario de prueba (César)
    const testUser = await prisma.user.findUnique({
      where: { email: 'cesar.espindola@utel.edu.mx' },
      include: { moodleToken: true }
    });

    if (!testUser) {
      console.error('❌ Usuario de prueba no encontrado');
      return;
    }

    console.log('\n📋 Usuario de prueba:');
    console.log(`   Email: ${testUser.email}`);
    console.log(`   Nombre: ${testUser.name}`);
    console.log(`   Matrícula: ${testUser.matricula}`);
    console.log(`   Token actual: ${testUser.moodleToken ? '✅ Configurado' : '❌ No configurado'}`);

    if (testUser.moodleToken) {
      console.log('\n⚠️  El usuario ya tiene un token configurado');
      console.log('   Eliminando token existente para probar generación automática...');
      
      await prisma.userMoodleToken.delete({
        where: { userId: testUser.id }
      });
      
      console.log('   ✅ Token eliminado');
    }

    // 2. Probar generación automática con credenciales
    console.log('\n🔐 Probando generación automática de token...');
    console.log('   Usando credenciales de Moodle del usuario...');
    
    const authService = new MoodleAuthService();
    
    // Credenciales de prueba (ajusta según tu configuración)
    const username = 'cesar.espindola';
    const password = 'Nala2024*';  // Usa la contraseña correcta aquí
    
    console.log(`   Username: ${username}`);
    console.log('   Password: [OCULTO]');
    
    const result = await authService.authenticateWithCredentials(
      testUser.id,
      username,
      password
    );

    if (result.success && result.token) {
      console.log('\n✅ Token generado exitosamente!');
      console.log(`   Token: ${result.token.substring(0, 20)}...`);
      console.log(`   User ID en Moodle: ${result.userId}`);
      console.log(`   Tipo: ${result.tokenType}`);
      
      // 3. Verificar que se guardó en la base de datos
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        include: { moodleToken: true }
      });
      
      if (updatedUser?.moodleToken) {
        console.log('\n✅ Token guardado correctamente en la base de datos');
        console.log(`   Encriptado: ${updatedUser.moodleToken.token.substring(0, 20)}...`);
        console.log(`   Es admin: ${updatedUser.moodleToken.isAdmin ? 'Sí' : 'No'}`);
        
        // 4. Probar que el token funciona
        console.log('\n🧪 Probando funcionamiento del token...');
        const testResult = await authService.testUserToken(testUser.id);
        
        if (testResult.success) {
          console.log('   ✅ Token funciona correctamente');
          console.log(`   Usuario Moodle: ${testResult.userInfo?.fullname}`);
          console.log(`   Email Moodle: ${testResult.userInfo?.email}`);
        } else {
          console.log('   ❌ Error al probar el token:', testResult.error);
        }
      } else {
        console.log('\n❌ Token no se guardó en la base de datos');
      }
    } else {
      console.log('\n❌ Error al generar token:', result.error);
      console.log('   Verifica las credenciales y la configuración de Moodle');
    }

    // 5. Probar también con el endpoint HTTP
    console.log('\n🌐 Probando endpoint HTTP de generación...');
    console.log('   Endpoint: /api/user/moodle-token/generate');
    
    const response = await fetch('http://localhost:3000/api/user/moodle-token/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: testUser.id,
        username: username,
        password: password
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Endpoint funciona correctamente');
      console.log(`   Respuesta: ${JSON.stringify(data, null, 2)}`);
    } else {
      const error = await response.text();
      console.log('   ❌ Error en endpoint:', error);
    }

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
  console.log('Prueba completada');
  console.log('='.repeat(60));
}

// Ejecutar la prueba
testAutomaticTokenGeneration().catch(console.error);
