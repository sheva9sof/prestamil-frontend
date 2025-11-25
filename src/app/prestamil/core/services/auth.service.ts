import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoginResponse } from '../models/auth-response.model';
import { NavigationItem } from '../../../theme/layout/admin/navigation/navigation';
import { transformOpcionesToNavigationItems } from '../helpers/menu-transformer.helper';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();
  
  private menuItemsSubject = new BehaviorSubject<NavigationItem[]>([]);
  public menuItems$ = this.menuItemsSubject.asObservable();

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
      'Usuarios': '/usuarios',
      'Usuario': '/usuarios',
      'Hardware': '/hardware',
      'Prendas': '/catalogos/prendas',
      'Sucursal': '/configuracion/sucursal',
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
    localStorage.setItem(this.AUTH_TOKEN_KEY, loginResponse.token);
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
}

