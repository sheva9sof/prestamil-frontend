import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoginResponse } from '../models/auth-response.model';
import { NavigationItem } from '../../../theme/layout/admin/navigation/navigation';
import { transformOpcionesToNavigationItems } from '../helpers/menu-transformer.helper';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private menuItemsSubject = new BehaviorSubject<NavigationItem[]>([]);
  public menuItems$ = this.menuItemsSubject.asObservable();
  
  private isLoggingOutSubject = new BehaviorSubject<boolean>(false);
  public isLoggingOut$ = this.isLoggingOutSubject.asObservable();

  private readonly AUTH_TOKEN_KEY = 'authToken';
  private readonly AUTH_USER_KEY = 'authUser';
  private readonly MENU_ITEMS_KEY = 'menuItems';
  private readonly API_URL = environment.apiUrl;

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
    
    // Cargar menú si hay sesión activa
    if (isAuth) {
      this.loadMenuFromStorage();
    }
  }
  
  /**
   * Cargar menú desde localStorage
   */
  private loadMenuFromStorage(): void {
    const menuStr = localStorage.getItem(this.MENU_ITEMS_KEY);
    if (menuStr) {
      try {
        const menuItems = JSON.parse(menuStr);
        // Regenerar URLs para elementos sin URL usando el mapeo
        const regeneratedMenu = this.regenerateMenuUrls(menuItems);
        console.log('Menu loaded from storage, regenerated:', JSON.stringify(regeneratedMenu, null, 2));
        this.menuItemsSubject.next(regeneratedMenu);
        // Guardar el menú regenerado
        localStorage.setItem(this.MENU_ITEMS_KEY, JSON.stringify(regeneratedMenu));
      } catch (e) {
        console.error('Error al cargar menú desde storage:', e);
      }
    }
  }

  /**
   * Regenerar URLs del menú para elementos que no tienen URL
   */
  private regenerateMenuUrls(menuItems: NavigationItem[]): NavigationItem[] {
    const opcionToUrlMap: { [key: string]: string } = {
    'Turnos': '/turnos',
      'Usuarios': '/usuarios',
      'Usuario': '/usuarios',
      'Hardware': '/hardware',
      'Prendas': '/catalogos/prendas',
      'Sucursal': '/configuracion/sucursal',
      'Empresas': '/configuracion/empresas',
      'Empresa': '/configuracion/empresas',
      'Parametros prestamo': '/configuracion/parametros-prestamo',
      'Parámetros Préstamo': '/configuracion/parametros-prestamo',
      'Parametros Generales': '/configuracion/parametros-generales',
      'Parámetros Generales': '/configuracion/parametros-generales',
      'Plazos y Periodos': '/configuracion/plazos-periodos',
    };

    return menuItems.map(item => {
      if (item.type === 'group' && item.children) {
        return {
          ...item,
          children: item.children.map(child => {
            if (child.type === 'item' && !child.url && !child.children) {
              const mappedUrl = opcionToUrlMap[child.title];
              if (mappedUrl) {
                return { ...child, url: mappedUrl };
              }
            } else if (child.type === 'collapse' && child.children) {
              return {
                ...child,
                children: child.children.map(subChild => {
                  if (subChild.type === 'item' && !subChild.url) {
                    const mappedUrl = opcionToUrlMap[subChild.title];
                    if (mappedUrl) {
                      return { ...subChild, url: mappedUrl };
                    }
                  }
                  return subChild;
                })
              };
            }
            return child;
          })
        };
      }
      return item;
    });
  }

  /**
   * Login - Llamada al backend
   * @param nombreUsuario Usuario
   * @param password Contraseña
   * @returns Observable con la respuesta del login
   */
  login(nombreUsuario: string, password: string): Observable<LoginResponse> {
    const loginUrl = `${this.API_URL}/auth/login`;
    const loginData = {
      nombreUsuario,
      password
    };
    
    console.log('Calling login API:', loginUrl, loginData);
    
    return this.http.post<LoginResponse>(loginUrl, loginData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Guardar sesión después de login exitoso
   * @param loginResponse Respuesta completa del login
   */
  setSession(loginResponse: LoginResponse): void {
    // Guardar solo el token crudo (sin el prefijo "Bearer ") para evitar duplicados
    const rawToken = loginResponse.token && loginResponse.token.startsWith('Bearer ')
      ? loginResponse.token.substring(7)
      : loginResponse.token;
    if (rawToken) {
      localStorage.setItem(this.AUTH_TOKEN_KEY, rawToken);
      console.debug('[AuthService] token saved (length):', rawToken.length);
    } else {
      localStorage.removeItem(this.AUTH_TOKEN_KEY);
      console.debug('[AuthService] no token in response, storage cleared');
    }
    localStorage.setItem(this.AUTH_USER_KEY, JSON.stringify({
      nombreUsuario: loginResponse.nombreUsuario,
      nombre: loginResponse.nombre,
      apellidos: loginResponse.apellidos,
      idRol: loginResponse.idRol
    }));
    
    // Transformar y guardar el menú
    if (loginResponse.opciones && loginResponse.opciones.length > 0) {
      const menuItems = transformOpcionesToNavigationItems(loginResponse.opciones);
      console.log('Transformed menu items:', JSON.stringify(menuItems, null, 2));
      localStorage.setItem(this.MENU_ITEMS_KEY, JSON.stringify(menuItems));
      this.menuItemsSubject.next(menuItems);
    }
    
    this.isAuthenticatedSubject.next(true);
  }

  /**
   * Logout - Limpiar sesión
   */
  logout(): void {
    localStorage.removeItem(this.AUTH_TOKEN_KEY);
    localStorage.removeItem(this.AUTH_USER_KEY);
    localStorage.removeItem(this.MENU_ITEMS_KEY);
    this.isAuthenticatedSubject.next(false);
    this.menuItemsSubject.next([]);
  }
  
  /**
   * Obtener items del menú
   * @returns NavigationItem[] del menú del usuario
   */
  getMenuItems(): NavigationItem[] {
    const menuItems = this.menuItemsSubject.value;
    // Si hay menú, regenerar URLs antes de retornar
    if (menuItems && menuItems.length > 0) {
      return this.regenerateMenuUrls(menuItems);
    }
    return menuItems;
  }
  
  /**
   * Forzar regeneración del menú desde localStorage
   */
  refreshMenu(): void {
    this.loadMenuFromStorage();
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

  /**
   * Obtener el ID del usuario desde el token JWT
   * @returns ID del usuario o null
   */
  getUserId(): number | null {
    const token = this.getToken();
    if (!token) {
      return null;
    }
    
    try {
      // Decodificar el payload del token JWT (segunda parte)
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.user_id || null;
    } catch (e) {
      console.error('Error al decodificar token:', e);
      return null;
    }
  }

  /**
   * Cambiar contraseña del usuario
   * @param userId ID del usuario
   * @param passwordActual Contraseña actual
   * @param passwordNueva Nueva contraseña
   * @returns Observable con la respuesta del servidor
   */
  cambiarPassword(userId: number, passwordActual: string, passwordNueva: string): Observable<any> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const url = `${this.API_URL}/api/usuarios/${userId}/cambiar-password`;
    const body = {
      passwordActual,
      passwordNueva
    };

    return this.http.post(url, body, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Refrescar el menú del usuario actual desde el backend
   * Llama al endpoint /me para obtener el perfil actualizado con las opciones de menú
   * Si no hay opciones de menú, desloguea automáticamente al usuario
   * @returns Observable con la respuesta del login actualizada
   */
  refreshMenuFromBackend(): Observable<LoginResponse> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No hay token de autenticación');
    }

    const url = `${this.API_URL}/api/usuarios/me`;
    
    return this.http.get<LoginResponse>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      switchMap((response: LoginResponse) => {
        // Actualizar el menú con la respuesta del backend
        if (response.opciones && response.opciones.length > 0) {
          const menuItems = transformOpcionesToNavigationItems(response.opciones);
          console.log('Menu refreshed from backend:', JSON.stringify(menuItems, null, 2));
          localStorage.setItem(this.MENU_ITEMS_KEY, JSON.stringify(menuItems));
          this.menuItemsSubject.next(menuItems);
          return of(response);
        } else {
          // Si no hay opciones, limpiar el menú y desloguear al usuario
          console.log('No menu items received from backend, logging out user');
          this.isLoggingOutSubject.next(true);
          localStorage.setItem(this.MENU_ITEMS_KEY, JSON.stringify([]));
          this.menuItemsSubject.next([]);
          
          // Desloguear automáticamente al usuario
          this.logout();
          
          // Navegar después de un pequeño delay para que el usuario vea el spinner
          setTimeout(() => {
            this.isLoggingOutSubject.next(false);
            this.router.navigate(['/login']);
          }, 1500);
          
          // Lanzar error para que el componente no continúe con el flujo normal
          return throwError(() => new Error('USUARIO_SIN_MENUS_AUTORIZADO'));
        }
      })
    );
  }
}

