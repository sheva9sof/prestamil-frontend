import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoginResponse } from '../models/auth-response.model';
import { NavigationItem } from '../../../theme/layout/admin/navigation/navigation';
import { transformOpcionesToNavigationItems } from '../helpers/menu-transformer.helper';
import { environment } from 'src/environments/environment';
import { AuthStreamService } from './auth-stream.service';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private authStreamService = inject(AuthStreamService);
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private menuItemsSubject = new BehaviorSubject<NavigationItem[]>([]);
  public menuItems$ = this.menuItemsSubject.asObservable();
  
  private isLoggingOutSubject = new BehaviorSubject<boolean>(false);
  public isLoggingOut$ = this.isLoggingOutSubject.asObservable();

  private readonly AUTH_USER_KEY = 'authUser';
  private readonly MENU_ITEMS_KEY = 'menuItems';
  private readonly API_URL = environment.apiUrl;

  constructor() {
    // Verificar si hay sesión guardada al iniciar
    this.checkAuthStatus();
  }

  /**
   * Verificar estado de autenticación al iniciar la aplicación
   * En sesiones stateful, la cookie HttpOnly se verifica automáticamente por el backend
   */
  checkAuthStatus(): void {
    const authUser = localStorage.getItem(this.AUTH_USER_KEY);
    const isAuth = !!authUser;
    this.isAuthenticatedSubject.next(isAuth);
    
    // Cargar menú si hay sesión activa
    if (isAuth) {
      this.loadMenuFromStorage();
      
      // Reconectar SSE con el usuario actual
      try {
        const user = JSON.parse(authUser);
        if (user && user.nombreUsuario) {
          this.authStreamService.connect(user.nombreUsuario);
        }
      } catch (e) {
        console.error('Error al reconectar SSE:', e);
      }
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
      'Avaluos': '/avaluos/mock',
      'Avaluos Prendarios': '/avaluos/mock',
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
   * La autenticación ahora se basa en cookies HttpOnly stateful
   * @param username Usuario
   * @param password Contraseña
   * @returns Observable con la respuesta del login
   */
  login(username: string, password: string): Observable<LoginResponse> {
    const loginUrl = `${this.API_URL}/auth/login`;
    const loginData = {
      username,  // Enviar "username" como espera el backend
      password
    };
    
    console.log('Calling login API:', loginUrl, loginData);
    
    return this.http.post<LoginResponse>(loginUrl, loginData, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true // IMPORTANTE: Para recibir y enviar cookies HttpOnly
    });
  }

  /**
   * Guardar sesión después de login exitoso
   * Ya NO guardamos token, solo datos de UI (authUser y menuItems)
   * La cookie de sesión HttpOnly viaja automáticamente
   * @param loginResponse Respuesta completa del login
   */
  setSession(loginResponse: LoginResponse): void {
    // Normalizar: usar nombreUsuario o username
    const nombreUsuario = loginResponse.nombreUsuario || loginResponse.username;
    
    // Guardar solo datos del usuario para UI (sin token)
    localStorage.setItem(this.AUTH_USER_KEY, JSON.stringify({
      nombreUsuario: nombreUsuario,
      nombre: loginResponse.nombre,
      apellidos: loginResponse.apellidos,
      idRol: loginResponse.idRol
    }));
    console.debug('[AuthService] Usuario guardado en localStorage (sin token)');
    
    // Transformar y guardar el menú
    if (loginResponse.opciones && loginResponse.opciones.length > 0) {
      const menuItems = transformOpcionesToNavigationItems(loginResponse.opciones);
      console.log('Transformed menu items:', JSON.stringify(menuItems, null, 2));
      localStorage.setItem(this.MENU_ITEMS_KEY, JSON.stringify(menuItems));
      this.menuItemsSubject.next(menuItems);
    }
    
    // Actualizar estado de autenticación
    this.isAuthenticatedSubject.next(true);
    
    // Conectar SSE para recibir eventos de logout forzado
    if (nombreUsuario) {
      console.log('[AuthService] Conectando SSE para usuario:', nombreUsuario);
      this.authStreamService.connect(nombreUsuario);
    }
  }

  /**
   * Logout - Limpiar sesión y desconectar SSE
   * Llama al endpoint de logout del backend para invalidar la sesión
   */
  logout(options: { notifyBackend?: boolean; message?: string } = {}): void {
    if (this.isLoggingOutSubject.value) {
      return;
    }

    const { notifyBackend = true, message } = options;

    console.log('[AuthService] Iniciando logout');
    this.isLoggingOutSubject.next(true);
    this.clearLocalSession();

    if (notifyBackend) {
      this.http.post(`${this.API_URL}/auth/logout`, {})
        .subscribe({
          next: () => {
            console.log('[AuthService] Logout exitoso en backend');
          },
          error: (err) => {
            console.warn('[AuthService] Error al hacer logout en backend:', err);
          }
        });
    }

    void this.navigateToLogin(message);
  }

  /**
   * Manejar invalidación de sesión reportada por el backend en una petición protegida.
   */
  handleSessionInvalidation(message = 'Sesión expirada. Por favor, inicia sesión nuevamente.'): void {
    this.logout({
      notifyBackend: false,
      message
    });
  }

  /**
   * Limpiar el estado local de autenticación.
   */
  private clearLocalSession(): void {
    this.authStreamService.disconnect();
    localStorage.removeItem(this.AUTH_USER_KEY);
    localStorage.removeItem(this.MENU_ITEMS_KEY);
    this.isAuthenticatedSubject.next(false);
    this.menuItemsSubject.next([]);
  }

  /**
   * Redirigir al login y resetear el estado transitorio de logout.
   */
  private async navigateToLogin(message?: string): Promise<void> {
    const queryParams = message ? { message } : undefined;

    try {
      await this.router.navigate(['/login'], {
        queryParams,
        replaceUrl: true
      });
    } finally {
      this.isLoggingOutSubject.next(false);
    }
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
   * Obtener información del usuario
   * @returns Usuario o null si no existe
   */
  getUser(): any {
    const userStr = localStorage.getItem(this.AUTH_USER_KEY);
    return userStr ? JSON.parse(userStr) : null;
  }

  /**
   * Obtener el ID del usuario desde los datos almacenados
   * @returns ID del usuario o null
   */
  getUserId(): number | null {
    const user = this.getUser();
    return user?.idUsuario || user?.userId || user?.id || null;
  }

  /**
   * Cambiar contraseña del usuario
   * Ya no se envía Authorization header, la sesión viaja en cookie HttpOnly
   * @param userId ID del usuario
   * @param passwordActual Contraseña actual
   * @param passwordNueva Nueva contraseña
   * @returns Observable con la respuesta del servidor
   */
  cambiarPassword(userId: number, passwordActual: string, passwordNueva: string): Observable<any> {
    const url = `${this.API_URL}/api/usuarios/${userId}/cambiar-password`;
    const body = {
      passwordActual,
      passwordNueva
    };

    return this.http.post(url, body);
  }

  /**
   * Refrescar el menú del usuario actual desde el backend
   * Llama al endpoint /me para obtener el perfil actualizado con las opciones de menú
   * Si no hay opciones de menú, desloguea automáticamente al usuario
   * @returns Observable con la respuesta del login actualizada
   */
  refreshMenuFromBackend(): Observable<LoginResponse> {
    const url = `${this.API_URL}/api/usuarios/me`;

    return this.http.get<LoginResponse>(url).pipe(
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

