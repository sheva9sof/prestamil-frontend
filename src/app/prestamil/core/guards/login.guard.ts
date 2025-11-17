import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard para evitar que usuarios autenticados accedan a la página de login
 * Redirige al dashboard si ya hay sesión activa
 */
export const loginGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    // Si ya está autenticado, redirigir al dashboard
    router.navigate(['/dashboard']);
    return false; // Bloquear acceso a login
  }
  return true; // Permitir acceso a login
};

