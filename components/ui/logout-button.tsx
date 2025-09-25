'use client'

import { signOut } from 'next-auth/react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faSignOutAlt } from '@fortawesome/free-solid-svg-icons'

interface LogoutButtonProps {
  compact?: boolean
}

export default function LogoutButton({ compact = true }: LogoutButtonProps) {
  const handleLogout = () => {
    // Obtener la URL base actual del navegador
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    const callbackUrl = `${baseUrl}/auth/login`
    
    signOut({ callbackUrl })
  }

  if (compact) {
    return (
      <button
        onClick={handleLogout}
        className="p-2 text-gray-600 hover:text-red-600 transition-colors duration-200"
        title="Cerrar sesión"
        aria-label="Cerrar sesión"
      >
        <FontAwesomeIcon icon={faSignOutAlt} className="w-5 h-5" />
      </button>
    )
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
