import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'
import { createSmartMoodleClient } from '@/lib/moodle/smart-client'
import { IntelligentDashboardContent } from '@/components/dashboard/intelligent-dashboard-content'

export default async function IntelligentDashboardPage() {
  // Verificar autenticación
  const session = await getServerSession(authOptions)
  
  if (!session?.user) {
    redirect('/auth/login')
  }

  console.log('📊 Cargando dashboard inteligente para:', session.user.name)
  console.log('🆔 Matrícula:', session.user.matricula)

  let coursesWithGroups: any[] = []
  let connectionStatus: 'connected' | 'disconnected' | 'failed' | 'error' = 'disconnected'
  let error: string | null = null

  try {
    // Crear cliente inteligente (no requiere configuración manual)
    const smartClient = createSmartMoodleClient(
      session.user.id,
      session.user.matricula || 'cesar.espindola' // Fallback para pruebas
    )

    // Probar conexión
    const isConnected = await smartClient.testConnection()
    connectionStatus = isConnected ? 'connected' : 'failed'

    if (isConnected) {
      // Obtener cursos usando autenticación inteligente
      coursesWithGroups = await smartClient.getTeacherCourses()
      console.log(`✅ Cursos cargados: ${coursesWithGroups.length}`)
    } else {
      error = 'No se pudo conectar con Moodle. Verifique la configuración.'
    }

  } catch (err: any) {
    console.error('❌ Error cargando dashboard:', err)
    error = err.message || 'Error desconocido al cargar datos'
    connectionStatus = 'error'
  }

  return (
    <IntelligentDashboardContent
      user={{
        id: session.user.id,
        name: session.user.name || '',
        firstName: session.user.name?.split(' ')[0] || '',
        matricula: session.user.matricula || 'cesar.espindola'
      }}
      coursesWithGroups={coursesWithGroups}
      connectionStatus={connectionStatus}
      error={error}
    />
  )
}
