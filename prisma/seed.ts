import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

  // Limpiar datos existentes
  await prisma.batchJob.deleteMany()
  await prisma.batchAnalysis.deleteMany()
  await prisma.courseActivity.deleteMany()
  await prisma.aulaCourse.deleteMany()
  await prisma.aula.deleteMany()

  console.log('🧹 Base de datos limpiada')

  // Crear aulas de ejemplo
  const aula101 = await prisma.aula.create({
    data: {
      aulaId: '101',
      name: 'Aula 101',
      baseUrl: 'https://aula101.utel.edu.mx',
      apiUrl: 'https://aula101.utel.edu.mx/webservice/rest/server.php',
      isActive: true,
    },
  })

  const aulaAV141 = await prisma.aula.create({
    data: {
      aulaId: 'av141',
      name: 'AV141',
      baseUrl: 'https://av141.utel.edu.mx',
      apiUrl: 'https://av141.utel.edu.mx/webservice/rest/server.php',
      isActive: true,
    },
  })

  console.log('🏫 Aulas creadas:', aula101.name, aulaAV141.name)

  // Crear curso de ejemplo
  const curso = await prisma.aulaCourse.create({
    data: {
      aulaId: 'av141',
      courseId: 259,
      courseName: 'Programación Web Avanzada',
      shortName: 'PWA',
      categoryName: 'Desarrollo Web',
      isActive: true,
      enrollmentCount: 25,
      rawData: {},
    },
  })

  console.log('📚 Curso creado:', curso.courseName)

  console.log('✅ Seed completado exitosamente!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Error en seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })