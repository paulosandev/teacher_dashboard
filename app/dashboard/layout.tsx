import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/get-session'
import DashboardHeader from '@/components/dashboard/header'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  
  if (!session) {
    redirect('/auth/login')
  }

  const userName = session.user.name || 'Profesor'

  return (
    <div className="min-h-screen bg-neutral-lightest">
      <DashboardHeader 
        userName={userName}
        userImage={undefined}
        notificationCount={0}
      />
      <main>
        {children}
      </main>
    </div>
  )
}
