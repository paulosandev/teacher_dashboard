import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'

export default async function Home() {
  const session = await getSession()
  
  if (session) {
    // Si ya está autenticado, redirigir al dashboard
    redirect('/dashboard')
  } else {
    // Si no está autenticado, redirigir al login
    redirect('/auth/login')
  }
}
