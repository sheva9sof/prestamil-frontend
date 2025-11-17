import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, delay } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private readonly AUTH_TOKEN_KEY = 'authToken';
  private readonly AUTH_USER_KEY = 'authUser';

  constructor() {
    // Verificar si hay sesión guardada al iniciar
    this.checkAuthStatus();
  }

  /**
   * Verificar estado de autenticación al iniciar la aplicación
   */
  checkAuthStatus(): void {
    const token = localStorage.getItem(this.AUTH_TOKEN_KEY);
    const isAuth = !!token; // En el futuro validar token con el backend
    this.isAuthenticatedSubject.next(isAuth);
  }

  /**
   * Login - Mock por ahora, en el futuro llamará a /login del backend
   * @param username Usuario
   * @param password Contraseña
   * @returns Observable con la respuesta del login
   */
  login(username: string, password: string): Observable<any> {
    // TODO: Reemplazar con llamada real al backend
    // return this.http.post<AuthResponse>('/api/login', { username, password });
    
    // Mock: Simular llamada al servidor con delay
    return of({
      success: true,
      token: 'mock-token-' + Date.now(),
      user: {
        username: username,
        id: 1
      }
    }).pipe(
      delay(1000) // Simular latencia de red
    );
  }

  /**
   * Guardar sesión después de login exitoso
   * @param token Token de autenticación
   * @param user Información del usuario
   */
  setSession(token: string, user: any): void {
    localStorage.setItem(this.AUTH_TOKEN_KEY, token);
    localStorage.setItem(this.AUTH_USER_KEY, JSON.stringify(user));
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Logout - Limpiar sesión
   */
  logout(): void {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    localStorage.removeItem(this.AUTH_USER_KEY);
    this.isAuthenticatedSubject.next(false);
  }

  /**
   * Verificar si el usuario está autenticado
   * @returns true si hay sesión activa
   */
  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  /**
   * Obtener token de autenticación
   * @returns Token o null si no existe
   */
  getToken(): string | null {
    return localStorage.getItem(this.AUTH_TOKEN_KEY);
  }

  /**
   * Obtener información del usuario
   * @returns Usuario o null si no existe
   */
  getUser(): any {
    const userStr = localStorage.getItem(this.AUTH_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }
}

