'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Check, AlertCircle, Key, LogOut, RefreshCw } from 'lucide-react';

interface MoodleTokenStatus {
  hasToken: boolean;
  username: string | null;
  lastUpdated: string | null;
}

export function MoodleAuthManager() {
  const [status, setStatus] = useState<MoodleTokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Verificar el estado del token al cargar
  useEffect(() => {
    checkTokenStatus();
  }, []);

  const checkTokenStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/auth/moodle');
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
        setShowForm(!data.hasToken);
      }
    } catch (error) {
      console.error('Error verificando token:', error);
      setError('Error al verificar el estado del token');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setAuthenticating(true);

    try {
      const response = await fetch('/api/auth/moodle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('¡Autenticación exitosa! Tu token de Moodle ha sido guardado.');
        setPassword('');
        setShowForm(false);
        await checkTokenStatus();
      } else {
        setError(data.error || 'Error al autenticar con Moodle');
      }
    } catch (error) {
      setError('Error de conexión. Por favor intenta nuevamente.');
    } finally {
      setAuthenticating(false);
    }
  };

  const handleRemoveToken = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar tu token de Moodle?')) {
      return;
    }

    try {
      const response = await fetch('/api/auth/moodle', {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('Token eliminado exitosamente');
        setStatus(null);
        setShowForm(true);
        setUsername('');
      } else {
        setError('Error al eliminar el token');
      }
    } catch (error) {
      setError('Error de conexión');
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Autenticación con Moodle
        </CardTitle>
        <CardDescription>
          Conecta tu cuenta de Moodle para acceder a datos detallados de tus cursos
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-4">
            <Check className="h-4 w-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {status?.hasToken && !showForm ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
              <div className="space-y-1">
                <p className="text-sm font-medium">Estado de conexión</p>
                <p className="text-sm text-muted-foreground">
                  Conectado como: <span className="font-mono">{status.username}</span>
                </p>
                {status.lastUpdated && (
                  <p className="text-xs text-muted-foreground">
                    Última actualización: {new Date(status.lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-500">Conectado</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Actualizar credenciales
              </Button>
              <Button
                variant="outline"
                onClick={handleRemoveToken}
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Desconectar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAuthenticate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Usuario de Moodle</Label>
              <Input
                id="username"
                type="text"
                placeholder="tu.usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={authenticating}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={authenticating}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={authenticating || !username || !password}
                className="flex items-center gap-2"
              >
                {authenticating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Conectar con Moodle
                  </>
                )}
              </Button>
              
              {status?.hasToken && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        )}

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Tus credenciales se usan únicamente para generar un token de acceso. 
            Tu contraseña no se almacena y el token se puede revocar en cualquier momento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
