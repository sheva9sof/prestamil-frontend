import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { environment } from 'src/environments/environment';

/**
 * Interceptor para manejar errores de autenticación
 * - 401 Unauthorized: sesión expirada o inválida
 * - 440 Login Timeout: sesión expirada (usado por algunos servidores)
 */
@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        const isBackendRequest = req.url.startsWith(environment.apiUrl);
        const isAuthLifecycleRequest = req.url.startsWith(`${environment.apiUrl}/auth/login`) ||
          req.url.startsWith(`${environment.apiUrl}/auth/logout`);
        const isSessionError = err && (err.status === 401 || err.status === 403 || err.status === 440);

        if (isBackendRequest && !isAuthLifecycleRequest && isSessionError && this.authService.isAuthenticated()) {
          console.log('[AuthErrorInterceptor] Sesión expirada, inválida o revocada (status:', err.status, ')');
          this.authService.handleSessionInvalidation('Sesión expirada o revocada. Por favor, inicia sesión nuevamente.');
        }
        
        return throwError(() => err);
      })
    );
  }
}
