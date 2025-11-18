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

  const isAuth = authService.isAuthenticated();
  console.log('AuthGuard check - isAuthenticated:', isAuth, 'route:', state.url);

  if (isAuth) {
    return true; // Permitir acceso
  } else {
    // Redirigir a login y guardar la URL intentada para redirigir después del login
    console.log('AuthGuard: Redirecting to login, returnUrl:', state.url);
    router.navigate(['/login'], { 
      queryParams: { returnUrl: state.url } 
    });
    return false; // Bloquear acceso
  }
};

