import { MoodleAuthManager } from '@/components/moodle-auth-manager';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Database, Shield, Bell } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Configuración
        </h1>
        <p className="text-muted-foreground mt-2">
          Gestiona las integraciones y preferencias de tu cuenta
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Autenticación con Moodle */}
        <div className="md:col-span-2">
          <MoodleAuthManager />
        </div>

        {/* Otras configuraciones futuras */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Sincronización de Datos
            </CardTitle>
            <CardDescription>
              Configura cómo y cuándo se sincronizan los datos con Moodle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: Configuración de sincronización automática y manual de cursos y análisis.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </CardTitle>
            <CardDescription>
              Gestiona las notificaciones y alertas del sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: Configuración de notificaciones por email y en la aplicación.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacidad y Seguridad
            </CardTitle>
            <CardDescription>
              Gestiona la privacidad y seguridad de tu cuenta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Próximamente: Configuración de autenticación de dos factores y permisos de acceso.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
