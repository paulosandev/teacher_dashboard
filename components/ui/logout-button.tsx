'use client'

import { signOut } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons'

export default function LogoutButton() {
  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/login' })
  }

  return (
    <button
      onClick={handleLogout}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors duration-200"
    >
      <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
      Cerrar Sesión
    </button>
  )
}
