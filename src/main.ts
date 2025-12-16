import { enableProdMode, importProvidersFrom } from '@angular/core';

import { environment } from './environments/environment';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { CredentialsInterceptor } from './app/prestamil/core/interceptors/credentials.interceptor';
import { AuthErrorInterceptor } from './app/prestamil/core/interceptors/auth-error.interceptor';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, AppRoutingModule), 
    provideAnimations(),
    provideHttpClient(withInterceptorsFromDi()),
    // Interceptor para enviar cookies HttpOnly en todas las peticiones
    { provide: HTTP_INTERCEPTORS, useClass: CredentialsInterceptor, multi: true },
    // Interceptor para manejar errores de autenticación (401/440)
    { provide: HTTP_INTERCEPTORS, useClass: AuthErrorInterceptor, multi: true }
  ]
}).catch((err) => console.error(err));
