# Limpieza Manual del Navegador

Para completar la limpieza total, también necesitas limpiar el navegador:

## Chrome/Safari/Firefox:

### Opción 1: DevTools
1. Abre Developer Tools (F12)
2. Ve a "Application" / "Storage" 
3. Elimina:
   - Local Storage
   - Session Storage
   - Cookies para localhost:3000

### Opción 2: Navegación Privada
1. Usa una ventana de incógnito/privada
2. O limpia completamente las cookies del sitio

### Opción 3: Hard Refresh
- Chrome/Firefox: Ctrl+Shift+R (Cmd+Shift+R en Mac)
- Safari: Cmd+Option+R

## NextAuth Session
Si tienes problemas con la sesión de NextAuth:
- Elimina la cookie `next-auth.session-token`
- Cierra y vuelve a abrir el navegador