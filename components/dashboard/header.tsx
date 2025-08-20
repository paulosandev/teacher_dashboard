'use client'

import { useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faPencilAlt, faBell, faGear, faKey, faSignOutAlt, faChevronDown, faTrashCan, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface HeaderProps {
  userName?: string
  userImage?: string
  notificationCount?: number
}

export default function DashboardHeader({ 
  userName = 'Profesor', 
  userImage,
  notificationCount = 0 
}: HeaderProps) {
  const pathname = usePathname()
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = () => {
    signOut({ callbackUrl: '/auth/login' })
  }

  const handleClearCache = async () => {
    // Confirmación antes de limpiar
    const confirmed = confirm(
      '¿Estás seguro de que quieres limpiar el caché?\n\nEsto eliminará todos los análisis guardados y será necesario regenerarlos.'
    )
    
    if (!confirmed) return

    try {
      setIsClearingCache(true)
      
      const response = await fetch('/api/analysis/cache/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // Mostrar mensaje de éxito
        alert(`Caché limpiado exitosamente.\n${data.message}`)
        // Cerrar dropdown
        setIsProfileDropdownOpen(false)
        // Recargar la página para reflejar los cambios
        window.location.reload()
      } else {
        alert(`Error al limpiar caché: ${data.error || 'Error desconocido'}`)
      }
    } catch (error) {
      console.error('Error limpiando caché:', error)
      alert('Error de conexión al limpiar caché')
    } finally {
      setIsClearingCache(false)
    }
  }
  
  return (
    <header className="pt-3 pb-6">
      <div className="max-w-[1132px] mx-auto px-4 sm:px-6 lg:px-3">
        <div className="bg-white rounded-lg shadow-[0px_4px_10px_rgba(0,0,0,0.2)] p-3 flex justify-between items-center h-[68px]">
          {/* Logo, título y navegación */}
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <Link href="/dashboard/v2" className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center">
                  <svg width="44" height="40" viewBox="0 0 44 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M3.26005 34.0251C4.78217 36.5589 8.34627 37.444 12.8283 37.8094C17.2917 38.0904 22.6636 37.8562 27.3705 36.2779L33.9648 33.9923C38.6529 32.414 42.0484 28.9436 42.9944 24.0681C43.9639 19.2816 42.484 13.0995 38.0159 8.11628C33.6416 3.06284 27.4267 0.412006 22.3732 0.112265C17.2167 -0.215577 13.2311 1.81704 10.8847 5.48418C9.76068 7.19832 8.63665 8.91247 7.50794 10.6266C5.15216 14.3125 3.86889 19.0428 2.94626 23.3375C2.12197 27.6556 1.66299 31.5382 3.26005 34.0204"
                      fill="#C3EA1B"
                    />
                    <path
                      d="M18.6923 1.89203C13.5311 4.20565 8.74463 7.26394 4.478 10.9732C1.00757 14.1065 -0.795562 16.6496 0.337833 19.38C0.824912 20.6492 1.37756 21.97 1.99578 23.3375C3.32119 26.2272 6.74479 29.3464 9.79372 32.3532C12.9691 35.3084 15.7792 38.1466 18.6876 39.3877C21.5867 40.6195 24.8089 40.0247 28.4339 37.313C31.9418 34.6574 35.8478 29.8944 37.3043 24.0213C37.9881 21.3283 38.5407 18.5932 38.9623 15.8066C39.9598 9.78364 37.6743 4.43514 33.7543 1.91076C29.8342 -0.726023 24.2843 -0.538685 18.6876 1.88734"
                      fill="#45AB0F"
                    />
                    <path
                      d="M25.3989 20.0029V21.5672C25.3989 21.6936 25.3942 21.8248 25.3802 21.9512C25.3099 22.7287 25.0242 23.4687 24.5559 24.0962C24.4294 24.2695 24.2889 24.4335 24.1391 24.5833C23.3429 25.3889 22.2563 25.8432 21.1276 25.8432C19.9942 25.8432 18.9123 25.3889 18.1161 24.5833C17.9663 24.4288 17.8258 24.2695 17.6993 24.0962C17.231 23.4733 16.9453 22.7287 16.875 21.9512C16.8657 21.8248 16.8563 21.6983 16.8563 21.5672V10.2754H12.9643V21.5625C12.9643 21.689 12.9643 21.8201 12.9737 21.9465C13.0393 23.3235 13.4561 24.6629 14.182 25.8385C14.8565 26.9204 15.7744 27.8336 16.8563 28.5127C19.4743 30.1379 22.7855 30.1379 25.3989 28.5127C26.4808 27.8383 27.3941 26.9204 28.0732 25.8385C28.7991 24.6676 29.2159 23.3282 29.2815 21.9465C29.2862 21.8201 29.2908 21.689 29.2908 21.5625V10.2754H25.3989V20.0029Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <span className="bg-primary-light text-green-900 px-4 py-3 rounded-md text-sm font-medium flex items-center gap-2">
                  <FontAwesomeIcon icon={faPencilAlt} className="w-3 h-3 text-icon-dark" />
                  Portal docente
                </span>
              </Link>
            </div>
            
            {/* Navegación */}
            <nav className="flex items-center space-x-1">
              {/* Los links se movieron al dropdown del perfil */}
            </nav>
          </div>

          {/* Notificaciones y perfil */}
          <div className="flex items-center space-x-4">
            <div className="relative cursor-pointer">
              <FontAwesomeIcon icon={faBell} className="w-5 h-5 text-neutral-dark" />
              {notificationCount > 0 && (
                <span className="absolute -top-3 -right-2 w-4 h-4 bg-primary-dark rounded-full text-xs flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{notificationCount}</span>
                </span>
              )}
            </div>
            
            {/* Perfil con dropdown */}
            <div className="relative" ref={dropdownRef}>
              <div 
                className="flex items-center gap-3 cursor-pointer"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              >
                {userImage ? (
                  <div className="w-10 h-10 rounded-md overflow-hidden">
                    <img 
                      src={userImage} 
                      alt={userName} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-md bg-primary-light flex items-center justify-center">
                    <span className="text-primary-darker font-semibold">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Dropdown menu */}
              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">
                      <div className="font-medium">{userName}</div>
                      <div className="text-gray-500">Profesor</div>
                    </div>
                    <Link
                      href="/settings/moodle-token"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                        pathname === '/settings/moodle-token' 
                          ? 'text-primary-darker bg-primary-light/50' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <FontAwesomeIcon icon={faKey} className="w-4 h-4" />
                      Token Moodle
                    </Link>
                    <Link
                      href="/dashboard/settings"
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                        pathname === '/dashboard/settings' 
                          ? 'text-primary-darker bg-primary-light/50' 
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <FontAwesomeIcon icon={faGear} className="w-4 h-4" />
                      Configuración
                    </Link>
                    <button
                      onClick={handleClearCache}
                      disabled={isClearingCache}
                      className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                        isClearingCache 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-red-600 hover:bg-red-50'
                      }`}
                    >
                      <FontAwesomeIcon 
                        icon={isClearingCache ? faSpinner : faTrashCan} 
                        className={`w-4 h-4 ${isClearingCache ? 'animate-spin' : ''}`} 
                      />
                      {isClearingCache ? 'Limpiando...' : 'Limpiar caché'}
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                    >
                      <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
