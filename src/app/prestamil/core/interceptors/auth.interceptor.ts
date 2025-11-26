import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    if (!token) {
      console.debug('[AuthInterceptor] no token found, forwarding request without Authorization');
      return next.handle(req);
    }

    // Asegurarse de no duplicar el prefijo "Bearer " si el token ya lo contiene
    const headerValue = token.startsWith('Bearer ') ? token : `Bearer ${token}`;

    console.debug('[AuthInterceptor] attaching Authorization header:', headerValue);
    const authReq = req.clone({ setHeaders: { Authorization: headerValue } });
    return next.handle(authReq);
  }
}
