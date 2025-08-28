import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

  // Limpiar datos existentes del nuevo schema
  await prisma.activityAnalysis.deleteMany()
  await prisma.analysisResult.deleteMany()
  await prisma.jobLog.deleteMany()
  await prisma.group.deleteMany()
  await prisma.course.deleteMany()

  console.log('🧹 Base de datos limpiada')

  // Crear cursos de prueba (sin usuarios persistentes)
  const course1 = await prisma.course.create({
    data: {
      moodleCourseId: '259',
      name: 'Programación Web Avanzada',
      shortName: 'PWA',
      lastAnalyzedBy: 'cesar.espindola',
      isActive: true,
    },
  })

  const course2 = await prisma.course.create({
    data: {
      moodleCourseId: '260',
      name: 'Base de Datos',
      shortName: 'BD',
      lastAnalyzedBy: 'cesar.espindola',
      isActive: true,
    },
  })

  console.log('📚 Cursos creados:', course1.name, course2.name)

  // Crear ejemplos de análisis de actividades
  const activityAnalysis1 = await prisma.activityAnalysis.create({
    data: {
      courseId: course1.id,
      moodleCourseId: '259',
      activityId: '123',
      activityType: 'forum',
      activityName: 'Foro Semana 1',
      summary: 'Participación activa con buena calidad en las discusiones del foro.',
      positives: [
        'Tono respetuoso en las participaciones',
        'Ejemplos laborales conectan teoría-práctica',
        'Debate constructivo sobre eficacia vs eficiencia'
      ],
      alerts: [
        'Solo 43% cita correctamente en formato APA',
        'El 60% publica al final del plazo',
        'Algunos textos escritos en MAYÚSCULAS'
      ],
      insights: [
        'Los estudiantes comprenden los conceptos pero necesitan refuerzo en formato académico',
        'La participación se concentra al final del período'
      ],
      recommendation: 'Enviar recordatorio sobre formato APA/netiqueta y activar avisos 48h antes del cierre',
      fullAnalysis: '## Análisis del Foro Semana 1\n\nEste foro muestra buena participación estudiantil con discusiones de calidad. Los estudiantes demuestran comprensión de conceptos pero requieren refuerzo en formato académico.',
      activityData: {
        participants: 17,
        messages: 45,
        completion: '70%'
      },
      llmResponse: {
        model: 'gpt-4',
        usage: { prompt_tokens: 1200, completion_tokens: 500 }
      }
    }
  })

  console.log('📊 Análisis de actividad creado:', activityAnalysis1.activityName)

  // Crear registro de jobs de ejemplo
  await prisma.jobLog.create({
    data: {
      jobId: 'job_001',
      jobType: 'scheduled',
      status: 'completed',
      courseId: course1.id,
      startedAt: new Date(Date.now() - 60000), // Hace 1 minuto
      completedAt: new Date(),
    },
  })

  console.log('📋 Registro de jobs creado')

  console.log('✅ Seed completado exitosamente!')
  console.log('📚 Cursos disponibles para pruebas con ID Moodle 259 y 260')
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
