import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...')

  // Limpiar datos existentes
  await prisma.analysisResult.deleteMany()
  await prisma.jobLog.deleteMany()
  await prisma.forum.deleteMany()
  await prisma.activity.deleteMany()
  await prisma.group.deleteMany()
  await prisma.course.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()

  console.log('🧹 Base de datos limpiada')

  // Crear usuario de prueba
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const testUser = await prisma.user.create({
    data: {
      email: 'profesor@test.com',
      username: 'profesor_test',
      password: hashedPassword,
      matricula: 'MAT001',
      name: 'Profesor de Prueba',
    },
  })

  console.log('👤 Usuario de prueba creado:', testUser.email)

  // Crear cursos de prueba
  const course1 = await prisma.course.create({
    data: {
      moodleCourseId: 'MOODLE_001',
      name: 'Programación Web Avanzada',
      shortName: 'PWA',
      userId: testUser.id,
      isActive: true,
    },
  })

  const course2 = await prisma.course.create({
    data: {
      moodleCourseId: 'MOODLE_002',
      name: 'Base de Datos',
      shortName: 'BD',
      userId: testUser.id,
      isActive: true,
    },
  })

  console.log('📚 Cursos creados:', course1.name, course2.name)

  // Crear grupos para el curso 1
  const group1 = await prisma.group.create({
    data: {
      moodleGroupId: 'GROUP_001',
      name: 'Grupo A - Matutino',
      courseId: course1.id,
    },
  })

  const group2 = await prisma.group.create({
    data: {
      moodleGroupId: 'GROUP_002',
      name: 'Grupo B - Vespertino',
      courseId: course1.id,
    },
  })

  console.log('👥 Grupos creados:', group1.name, group2.name)

  // Crear actividades para el curso 1
  const activity1 = await prisma.activity.create({
    data: {
      moodleActivityId: 'ACT_001',
      name: 'Tarea 1: Crear API REST',
      type: 'assignment',
      courseId: course1.id,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // En 7 días
      isOpen: true,
    },
  })

  const activity2 = await prisma.activity.create({
    data: {
      moodleActivityId: 'ACT_002',
      name: 'Quiz: Conceptos de React',
      type: 'quiz',
      courseId: course1.id,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // En 3 días
      isOpen: true,
    },
  })

  console.log('📝 Actividades creadas:', activity1.name, activity2.name)

  // Crear foros para el curso 1
  const forum1 = await prisma.forum.create({
    data: {
      moodleForumId: 'FORUM_001',
      name: 'Foro Semana 1',
      courseId: course1.id,
      isOpen: true,
    },
  })

  const forum2 = await prisma.forum.create({
    data: {
      moodleForumId: 'FORUM_002',
      name: 'Foro Ruta hacia el éxito Profesional',
      courseId: course1.id,
      isOpen: true,
    },
  })

  console.log('💬 Foros creados:', forum1.name, forum2.name)

  // Crear resultados de análisis de ejemplo - como en la maquetación
  
  // Foro Semana 1 - Card 1
  const analysisResult1 = await prisma.analysisResult.create({
    data: {
      groupId: group1.id,
      forumId: forum1.id,
      analysisType: 'forum',
      strengths: [
        {
          id: '1',
          description: 'tono respetuoso, varios ejemplos laborales que conectan teoría-práctica, debate eficaz vs eficiente',
          evidence: '45 mensajes de 17 alumnos; 70% ya completó las dos etapas',
        },
      ],
      alerts: [
        {
          id: '1',
          description: 'sólo 43% cita correctamente en APA y 60% publica al final del plazo; algunos textos en MAYÚSCULAS',
          severity: 'medium',
        },
      ],
      nextStep: 'enviar recordatorio breve sobre formato APA/netiqueta y activar aviso 48 h antes del siguiente cierre para repartir mejor la participación',
      isLatest: true,
      confidence: 0.92,
    },
  })

  // Foro Ruta hacia el éxito Profesional - Card 2
  const analysisResult2 = await prisma.analysisResult.create({
    data: {
      groupId: group1.id,
      forumId: forum2.id,
      analysisType: 'forum',
      strengths: [
        {
          id: '1',
          description: 'tono respetuoso, varios ejemplos laborales que conectan teoría-práctica, debate eficaz vs eficiente',
          evidence: '45 mensajes de 17 alumnos; 70% ya completó las dos etapas',
        },
      ],
      alerts: [
        {
          id: '1',
          description: 'sólo 43% cita correctamente en APA y 60% publica al final del plazo; algunos textos en MAYÚSCULAS',
          severity: 'medium',
        },
      ],
      nextStep: 'enviar recordatorio breve sobre formato APA/netiqueta y activar aviso 48 h antes del siguiente cierre para repartir mejor la participación',
      isLatest: true,
      confidence: 0.88,
    },
  })

  // Actividad: Tarea 1 - Card 3 (ancho completo)
  const analysisResult3 = await prisma.analysisResult.create({
    data: {
      groupId: group1.id,
      activityId: activity1.id,
      analysisType: 'activity',
      strengths: [
        {
          id: '1',
          description: 'El 85% de los estudiantes entregaron la tarea antes de tiempo',
          evidence: '32 de 38 estudiantes han completado la actividad',
        },
        {
          id: '2',
          description: 'Código bien estructurado y documentado en la mayoría de entregas',
        },
      ],
      alerts: [
        {
          id: '1',
          description: '3 estudiantes no han iniciado la tarea',
          severity: 'high',
          studentIds: ['student_1', 'student_2', 'student_3'],
        },
        {
          id: '2',
          description: 'Algunos estudiantes muestran confusión con async/await',
          severity: 'medium',
        },
      ],
      nextStep: 'Programar sesión de refuerzo sobre programación asíncrona y contactar individualmente a los 3 estudiantes rezagados',
      isLatest: true,
      confidence: 0.95,
    },
  })

  // Quiz: Conceptos de React - Card 4 (ancho completo)
  const analysisResult4 = await prisma.analysisResult.create({
    data: {
      groupId: group2.id,
      activityId: activity2.id,
      analysisType: 'activity',
      strengths: [
        {
          id: '1',
          description: 'Comprensión sólida de hooks básicos (useState, useEffect)',
          evidence: '28 de 35 estudiantes obtuvieron más del 80% de aciertos',
        },
      ],
      alerts: [
        {
          id: '1',
          description: 'Confusión generalizada con useCallback y useMemo',
          severity: 'medium',
        },
        {
          id: '2',
          description: '7 estudiantes no han realizado el quiz a 24h del cierre',
          severity: 'high',
        },
      ],
      nextStep: 'Preparar material adicional sobre optimización con useCallback/useMemo y enviar recordatorio urgente a estudiantes pendientes',
      isLatest: true,
      confidence: 0.90,
    },
  })

  console.log('📊 Resultados de análisis creados')

  // Crear registro de jobs de ejemplo
  await prisma.jobLog.create({
    data: {
      jobId: 'job_001',
      jobType: 'scheduled',
      status: 'completed',
      courseId: course1.id,
      groupId: group1.id,
      startedAt: new Date(Date.now() - 60000), // Hace 1 minuto
      completedAt: new Date(),
    },
  })

  console.log('📋 Registro de jobs creado')

  console.log('✅ Seed completado exitosamente!')
  console.log('👤 Credenciales de prueba:')
  console.log('   Email: profesor@test.com')
  console.log('   Password: password123')
  console.log('   Matrícula: MAT001')
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
