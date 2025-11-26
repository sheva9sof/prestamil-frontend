import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthErrorInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(
      catchError((err: HttpErrorResponse) => {
        if (err && err.status === 401) {
          // Token inválido o expirado: limpiar sesión y redirigir a login
          try {
            this.authService.logout();
          } catch (e) {
            console.warn('Error during logout after 401', e);
          }
          // Navegar al login
          this.router.navigate(['/login']);
        }
        return throwError(() => err);
      })
    );
  }
}
