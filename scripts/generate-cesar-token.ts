import { PrismaClient } from '@prisma/client';
import { encrypt } from '../lib/utils/encryption';

const prisma = new PrismaClient();

async function generateCesarToken() {
  console.log('='.repeat(60));
  console.log('Generando token para César Espíndola');
  console.log('='.repeat(60));

  try {
    // Buscar el usuario César
    const user = await prisma.user.findUnique({
      where: { email: 'cesar.espindola@utel.edu.mx' }
    });

    if (!user) {
      console.error('❌ Usuario César no encontrado');
      return;
    }

    console.log('\n📋 Usuario encontrado:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Matrícula: ${user.matricula}`);

    // Credenciales de César
    const username = 'cesar.espindola';
    const password = 'admin1234';
    
    console.log('\n🔄 Intentando generar token con credenciales...');
    console.log(`   Username: ${username}`);

    // Llamar a la API de Moodle para obtener token
    const MOODLE_URL = process.env.MOODLE_URL || 'https://av141.utel.edu.mx';
    const tokenUrl = `${MOODLE_URL}/login/token.php`;
    
    console.log(`   URL: ${tokenUrl}`);

    const params = new URLSearchParams({
      username: username,
      password: password,
      service: 'moodle_mobile_app' // Servicio estándar para autenticación
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json();

    if (data.error) {
      console.error(`\n❌ Error obteniendo token: ${data.error}`);
      
      // Intentar con otro servicio
      console.log('\n🔄 Intentando con servicio alternativo...');
      const params2 = new URLSearchParams({
        username: username,
        password: password,
        service: 'moodle_webservice' // Servicio alternativo
      });

      const response2 = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params2.toString()
      });

      const data2 = await response2.json();
      
      if (data2.error) {
        console.error(`❌ Error con servicio alternativo: ${data2.error}`);
        return;
      }

      data.token = data2.token;
    }

    if (!data.token) {
      console.error('❌ No se pudo obtener el token');
      return;
    }

    console.log('\n✅ Token obtenido exitosamente');
    console.log(`   Token (primeros 10 caracteres): ${data.token.substring(0, 10)}...`);

    // Verificar el token obteniendo información del usuario
    const MOODLE_API_URL = process.env.MOODLE_API_URL || 'https://av141.utel.edu.mx/webservice/rest/server.php';
    const userInfoUrl = new URL(MOODLE_API_URL);
    userInfoUrl.searchParams.append('wstoken', data.token);
    userInfoUrl.searchParams.append('wsfunction', 'core_webservice_get_site_info');
    userInfoUrl.searchParams.append('moodlewsrestformat', 'json');

    const userInfoResponse = await fetch(userInfoUrl.toString());
    const userInfo = await userInfoResponse.json();

    if (userInfo.errorcode) {
      console.error(`\n❌ Token inválido: ${userInfo.message}`);
      return;
    }

    console.log('\n📋 Información del usuario en Moodle:');
    console.log(`   Nombre: ${userInfo.fullname}`);
    console.log(`   Username: ${userInfo.username}`);
    console.log(`   User ID: ${userInfo.userid}`);

    // Encriptar y guardar el token
    const encryptedToken = encrypt(data.token);

    const result = await prisma.userMoodleToken.upsert({
      where: { userId: user.id },
      update: {
        token: encryptedToken,
        moodleUserId: userInfo.userid,
        moodleUsername: userInfo.username,
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        token: encryptedToken,
        moodleUserId: userInfo.userid,
        moodleUsername: userInfo.username,
        isActive: true
      }
    });

    console.log('\n✅ Token guardado exitosamente');
    console.log(`   Token ID: ${result.id}`);
    console.log(`   Usuario Moodle: ${result.moodleUsername}`);

  } catch (error) {
    console.error('\n❌ Error generando token:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
}

// Ejecutar el script
generateCesarToken().catch(console.error);
