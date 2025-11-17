import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para proteger rutas que requieren autenticación
 * Redirige a /login si no hay sesión activa
 */
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true; // Permitir acceso
  } else {
    // Redirigir a login y guardar la URL intentada para redirigir después del login
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false; // Bloquear acceso
  }
};

