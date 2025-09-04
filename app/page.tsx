import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

export default async function Home() {
  const session = await getServerSession()
  
  if (session) {
    // Si ya está autenticado, redirigir al dashboard v2
    redirect('/dashboard/v3')
  } else {
    // Si no está autenticado, redirigir al login
    redirect('/auth/login')
  }
}
