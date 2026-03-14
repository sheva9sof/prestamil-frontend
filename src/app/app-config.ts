import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { CredentialsInterceptor } from './prestamil/core/interceptors/credentials.interceptor';
import { AuthErrorInterceptor } from './prestamil/core/interceptors/auth-error.interceptor';

export const appConfig: ApplicationConfig = {
	providers: [
		importProvidersFrom(BrowserModule, AppRoutingModule),
		provideAnimations(),
		provideHttpClient(withInterceptorsFromDi()),
		{ provide: HTTP_INTERCEPTORS, useClass: CredentialsInterceptor, multi: true },
		{ provide: HTTP_INTERCEPTORS, useClass: AuthErrorInterceptor, multi: true }
	]
};
