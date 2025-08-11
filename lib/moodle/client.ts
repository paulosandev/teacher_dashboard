/**
 * Cliente de Moodle para obtener datos
 * Por ahora retorna datos mock, después se integrará con la API real de Moodle
 */

interface MoodleDataRequest {
  courseId: string
  groupId?: string
  activityId?: string
  forumId?: string
  type: 'activity' | 'forum'
}

export async function fetchMoodleData(request: MoodleDataRequest): Promise<any> {
  const { courseId, groupId, activityId, forumId, type } = request
  
  console.log(`📡 Conectando con Moodle...`)
  console.log(`   Tipo: ${type}`)
  console.log(`   Curso: ${courseId}`)
  
  // Simular delay de API
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Por ahora retornamos datos mock
  // Después aquí haremos las llamadas reales a la API de Moodle
  
  if (type === 'forum') {
    return {
      forumId,
      courseId,
      groupId,
      posts: generateMockForumPosts(),
      participation: {
        totalStudents: 25,
        activeStudents: 17,
        totalPosts: 45,
      },
      lastActivity: new Date().toISOString(),
    }
  }
  
  if (type === 'activity') {
    return {
      activityId,
      courseId,
      groupId,
      submissions: generateMockSubmissions(),
      stats: {
        totalStudents: 25,
        submitted: Math.floor(Math.random() * 10) + 15,
        pending: Math.floor(Math.random() * 10),
        graded: Math.floor(Math.random() * 15),
      },
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }
  }
  
  return {}
}

function generateMockForumPosts() {
  const posts = []
  const numPosts = Math.floor(Math.random() * 30) + 20
  
  for (let i = 0; i < numPosts; i++) {
    posts.push({
      id: `post_${i}`,
      userId: `student_${Math.floor(Math.random() * 25)}`,
      message: `Este es un mensaje de ejemplo del foro #${i}`,
      timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      wordCount: Math.floor(Math.random() * 200) + 50,
    })
  }
  
  return posts
}

function generateMockSubmissions() {
  const submissions = []
  const numSubmissions = Math.floor(Math.random() * 10) + 15
  
  for (let i = 0; i < numSubmissions; i++) {
    submissions.push({
      id: `submission_${i}`,
      userId: `student_${i}`,
      submittedAt: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
      grade: Math.random() > 0.5 ? Math.floor(Math.random() * 30) + 70 : null,
      status: Math.random() > 0.3 ? 'submitted' : 'draft',
    })
  }
  
  return submissions
}

/**
 * Verificar conexión con Moodle
 */
export async function testMoodleConnection(): Promise<boolean> {
  try {
    console.log('🔍 Verificando conexión con Moodle...')
    // Simular verificación
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Por ahora siempre retorna true
    // Después aquí verificaremos la conexión real
    console.log('✅ Conexión con Moodle exitosa (mock)')
    return true
  } catch (error) {
    console.error('❌ Error al conectar con Moodle:', error)
    return false
  }
}
