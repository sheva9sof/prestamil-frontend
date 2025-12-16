import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

/**
 * Interceptor para incluir credenciales (cookies HttpOnly) en todas las peticiones
 * Esto permite que las sesiones stateful funcionen correctamente
 */
@Injectable()
export class CredentialsInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Clonar la petición y añadir withCredentials: true para enviar cookies
    const credReq = req.clone({
      withCredentials: true
    });
    
    return next.handle(credReq);
  }
}
