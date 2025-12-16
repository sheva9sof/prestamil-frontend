import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

/**
 * Interceptor para manejar errores de autenticación
 * - 401 Unauthorized: sesión expirada o inválida
 * - 440 Login Timeout: sesión expirada (usado por algunos servidores)
 */
@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        // Manejar errores 401 (Unauthorized) o 440 (Login Timeout)
        if (err && (err.status === 401 || err.status === 440)) {
          console.log('[AuthErrorInterceptor] Sesión expirada o inválida (status:', err.status, ')');
          
          try {
            // Limpiar sesión y desconectar SSE
            this.authService.logout();
          } catch (e) {
            console.warn('[AuthErrorInterceptor] Error durante logout después de', err.status, ':', e);
          }
          
          // Navegar al login con mensaje
          this.router.navigate(['/login'], {
            queryParams: { 
              message: 'Sesión expirada. Por favor, inicia sesión nuevamente.' 
            }
          });
        }
        
        return throwError(() => err);
      })
    );
  }
}
