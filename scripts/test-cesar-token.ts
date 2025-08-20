import { PrismaClient } from '@prisma/client';
import { decrypt } from '../lib/utils/encryption';

const prisma = new PrismaClient();

async function testCesarToken() {
  console.log('='.repeat(60));
  console.log('Probando token de César Espíndola');
  console.log('='.repeat(60));

  try {
    // Buscar el usuario César con su token
    const user = await prisma.user.findUnique({
      where: { email: 'cesar.espindola@utel.edu.mx' },
      include: { moodleToken: true }
    });

    if (!user || !user.moodleToken) {
      console.error('❌ Usuario o token no encontrado');
      return;
    }

    console.log('\n📋 Token encontrado:');
    console.log(`   Usuario: ${user.name}`);
    console.log(`   Moodle Username: ${user.moodleToken.moodleUsername}`);
    console.log(`   Moodle User ID: ${user.moodleToken.moodleUserId}`);
    console.log(`   Activo: ${user.moodleToken.isActive}`);

    // Desencriptar el token
    const token = decrypt(user.moodleToken.token);
    console.log(`   Token (primeros 10 caracteres): ${token.substring(0, 10)}...`);

    // Probar el token con la API de Moodle
    const MOODLE_API_URL = process.env.MOODLE_API_URL || 'https://moodletest2.utel.edu.mx/webservice/rest/server.php';
    
    console.log('\n🔄 Probando token con API de Moodle...');
    console.log(`   URL: ${MOODLE_API_URL}`);

    // Obtener información del usuario
    const userInfoUrl = new URL(MOODLE_API_URL);
    userInfoUrl.searchParams.append('wstoken', token);
    userInfoUrl.searchParams.append('wsfunction', 'core_webservice_get_site_info');
    userInfoUrl.searchParams.append('moodlewsrestformat', 'json');

    const userInfoResponse = await fetch(userInfoUrl.toString());
    const userInfo = await userInfoResponse.json();

    if (userInfo.errorcode) {
      console.error(`\n❌ Error en API de Moodle: ${userInfo.message}`);
      return;
    }

    console.log('\n✅ Token válido! Información del usuario en Moodle:');
    console.log(`   Nombre: ${userInfo.fullname}`);
    console.log(`   Username: ${userInfo.username}`);
    console.log(`   User ID: ${userInfo.userid}`);
    console.log(`   Sitio: ${userInfo.sitename}`);

    // Obtener cursos del usuario
    console.log('\n🔄 Obteniendo cursos del usuario...');
    const coursesUrl = new URL(MOODLE_API_URL);
    coursesUrl.searchParams.append('wstoken', token);
    coursesUrl.searchParams.append('wsfunction', 'core_enrol_get_users_courses');
    coursesUrl.searchParams.append('userid', userInfo.userid.toString());
    coursesUrl.searchParams.append('moodlewsrestformat', 'json');

    const coursesResponse = await fetch(coursesUrl.toString());
    const courses = await coursesResponse.json();

    if (Array.isArray(courses)) {
      console.log(`\n📚 Cursos encontrados: ${courses.length}`);
      courses.slice(0, 5).forEach((course: any) => {
        console.log(`   - ${course.fullname} (ID: ${course.id})`);
      });
      if (courses.length > 5) {
        console.log(`   ... y ${courses.length - 5} más`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error probando token:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
}

// Ejecutar el script
testCesarToken().catch(console.error);
