import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import LogoutButton from '@/components/ui/logout-button'

export default async function DashboardPage() {
  const session = await getSession()
  
  if (!session) {
    redirect('/auth/login')
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Dashboard - Sistema de Análisis Académico
          </h1>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              Bienvenido, {session.user.name || session.user.email}!
            </h2>
            <div className="text-sm text-blue-700 space-y-1">
              <p>Email: {session.user.email}</p>
              <p>Matrícula: {session.user.matricula}</p>
              <p>Usuario: {session.user.username}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900">Cursos Activos</h3>
              <p className="text-2xl font-bold text-green-700">2</p>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900">Actividades Pendientes</h3>
              <p className="text-2xl font-bold text-yellow-700">4</p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900">Análisis Disponibles</h3>
              <p className="text-2xl font-bold text-purple-700">2</p>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Esta es una versión de prueba del dashboard. Las funcionalidades completas se añadirán próximamente.
            </p>
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  )
}
