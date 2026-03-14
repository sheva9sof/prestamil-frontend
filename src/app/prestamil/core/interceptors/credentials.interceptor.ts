import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * Interceptor para incluir credenciales (cookies HttpOnly) en todas las peticiones
 * Esto permite que las sesiones stateful funcionen correctamente
 */
@Injectable()
export class CredentialsInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isBackendRequest = req.url.startsWith(environment.apiUrl);

    if (!isBackendRequest || req.withCredentials) {
      return next.handle(req);
    }

    const credentialRequest = req.clone({ withCredentials: true });

    if (!environment.production) {
      console.debug('[CredentialsInterceptor] withCredentials=true', credentialRequest.method, credentialRequest.url);
    }

    return next.handle(credentialRequest);
  }
}
