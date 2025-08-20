import { PrismaClient } from '@prisma/client';
import { encrypt } from '../lib/utils/encryption';

const prisma = new PrismaClient();

async function configureCesarToken() {
  console.log('='.repeat(60));
  console.log('Configurando token para César Espíndola');
  console.log('='.repeat(60));

  try {
    // Buscar el usuario César
    const user = await prisma.user.findUnique({
      where: { email: 'cesar.espindola@utel.edu.mx' },
      include: { moodleToken: true }
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

    // Token de Moodle existente (el que está en .env.local)
    const moodleToken = 'e16e271b2e37da5ade1e439f3314069c';
    
    // Encriptar el token
    const encryptedToken = encrypt(moodleToken);

    // Guardar o actualizar el token
    const result = await prisma.userMoodleToken.upsert({
      where: { userId: user.id },
      update: {
        token: encryptedToken,
        moodleUserId: 179, // ID de César en Moodle
        moodleUsername: 'cesar.espindola',
        isActive: true,
        updatedAt: new Date()
      },
      create: {
        userId: user.id,
        token: encryptedToken,
        moodleUserId: 179,
        moodleUsername: 'cesar.espindola',
        isActive: true
      }
    });

    console.log('\n✅ Token configurado exitosamente');
    console.log(`   Token ID: ${result.id}`);
    console.log(`   Usuario Moodle: ${result.moodleUsername}`);
    console.log(`   Activo: ${result.isActive}`);

  } catch (error) {
    console.error('\n❌ Error configurando token:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n' + '='.repeat(60));
}

// Ejecutar el script
configureCesarToken().catch(console.error);
