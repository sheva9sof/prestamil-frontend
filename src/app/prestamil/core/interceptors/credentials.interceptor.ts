import { Injectable, Injector, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { SessionWarningService } from '../services/session-warning.service';

const EXCLUDED_ACTIVITY_URLS = [
  `${environment.apiUrl}/auth/logout`,
];

@Injectable()
export class CredentialsInterceptor implements HttpInterceptor {
  private injector = inject(Injector);
  private _sessionWarningService: SessionWarningService | null = null;

  private get sessionWarningService(): SessionWarningService {
    if (!this._sessionWarningService) {
      this._sessionWarningService = this.injector.get(SessionWarningService);
    }
    return this._sessionWarningService;
  }

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isBackendRequest = req.url.startsWith(environment.apiUrl);

    if (!isBackendRequest || req.withCredentials) {
      return next.handle(req);
    }

    const credentialRequest = req.clone({ withCredentials: true });

    if (!environment.production) {
      console.debug('[CredentialsInterceptor] withCredentials=true', credentialRequest.method, credentialRequest.url);
    }

    const shouldRecord = !EXCLUDED_ACTIVITY_URLS.some(url => req.url.startsWith(url));

    return next.handle(credentialRequest).pipe(
      tap(event => {
        if (shouldRecord && event instanceof HttpResponse) {
          this.sessionWarningService.recordActivity();
        }
      })
    );
  }
}
