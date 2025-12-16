import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * Servicio para gestionar conexión SSE (Server-Sent Events)
 * Recibe eventos de logout forzado desde el backend
 */
@Injectable({
  providedIn: 'root'
})
export class AuthStreamService {
  private router = inject(Router);
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private baseReconnectDelay = 2000; // 2 segundos
  private reconnectTimer: any = null;

  // Observable para notificar el estado de la conexión SSE
  private connectionStatusSubject = new Subject<{ status: string; lastEvent?: string }>();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  // Subject para controlar el estado de logout
  private isLoggingOutSubject = new Subject<boolean>();
  public isLoggingOut$ = this.isLoggingOutSubject.asObservable();

  /**
   * Conectar al stream SSE de logout para un usuario específico
   * @param username Nombre de usuario a monitorear
   */
  connect(username: string): void {
    if (this.eventSource) {
      console.log('[AuthStreamService] Cerrando conexión SSE previa');
      this.disconnect();
    }

    const sseUrl = `${environment.apiUrl}/auth/stream/logout?username=${encodeURIComponent(username)}`;
    console.log('[AuthStreamService] Conectando a SSE:', sseUrl);

    try {
      this.eventSource = new EventSource(sseUrl, { withCredentials: true });

      this.eventSource.onopen = () => {
        console.log('[AuthStreamService] Conexión SSE establecida');
        this.reconnectAttempts = 0;
        this.connectionStatusSubject.next({ status: 'conectado' });
      };

      this.eventSource.addEventListener('force-logout', (event: MessageEvent) => {
        console.log('[AuthStreamService] Evento force-logout recibido:', event.data);
        this.handleForceLogout(event.data);
      });

      this.eventSource.addEventListener('turno-cerrado', (event: MessageEvent) => {
        console.log('[AuthStreamService] Evento turno-cerrado recibido:', event.data);
        this.handleTurnoCerrado(event.data);
      });

      this.eventSource.onerror = (error) => {
        console.error('[AuthStreamService] Error en SSE:', error);
        this.connectionStatusSubject.next({ status: 'error' });
        
        // Cerrar la conexión actual
        if (this.eventSource) {
          this.eventSource.close();
          this.eventSource = null;
        }

        // Intentar reconexión con backoff exponencial
        this.attemptReconnect(username);
      };
    } catch (error) {
      console.error('[AuthStreamService] Error al crear EventSource:', error);
      this.connectionStatusSubject.next({ status: 'error' });
      this.attemptReconnect(username);
    }
  }

  /**
   * Manejar evento de logout forzado
   * @param message Mensaje del evento
   */
  private handleForceLogout(message: string): void {
    console.log('[AuthStreamService] Procesando force-logout:', message);
    
    // Emitir que se está deslogueando
    this.isLoggingOutSubject.next(true);
    
    // Notificar el estado antes de procesar
    this.connectionStatusSubject.next({ 
      status: 'force-logout', 
      lastEvent: message 
    });
    
    // Desconectar SSE primero
    this.disconnect();

    // Limpiar localStorage directamente para evitar dependencia circular
    localStorage.removeItem('authUser');
    localStorage.removeItem('menuItems');
    
    // Delay de 2 segundos para mostrar el spinner antes de navegar
    setTimeout(() => {
      // Emitir que ya no se está deslogueando
      this.isLoggingOutSubject.next(false);
      
      // Forzar navegación con recarga completa usando window.location
      window.location.href = '/login?message=' + encodeURIComponent('Sesión revocada: nuevo inicio en esta sucursal');
    }, 2000);
  }

  /**
   * Manejar evento de turno cerrado
   * @param message Mensaje del evento
   */
  private handleTurnoCerrado(message: string): void {
    console.log('[AuthStreamService] Procesando turno-cerrado:', message);
    
    // Emitir que se está deslogueando
    this.isLoggingOutSubject.next(true);
    
    // Notificar el estado
    this.connectionStatusSubject.next({ 
      status: 'turno-cerrado', 
      lastEvent: message 
    });
    
    // Desconectar SSE primero
    this.disconnect();

    // Limpiar localStorage
    localStorage.removeItem('authUser');
    localStorage.removeItem('menuItems');
    
    // Delay de 2 segundos para mostrar el spinner antes de navegar
    setTimeout(() => {
      // Emitir que ya no se está deslogueando
      this.isLoggingOutSubject.next(false);
      
      // Forzar navegación con recarga completa usando window.location
      window.location.href = '/login?message=' + encodeURIComponent('El turno ha sido cerrado. Por favor, inicia sesión nuevamente.');
    }, 2000);
  }

  /**
   * Intentar reconexión con backoff exponencial
   * @param username Usuario para reconectar
   */
  private attemptReconnect(username: string): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[AuthStreamService] Máximo de intentos de reconexión alcanzado');
      this.connectionStatusSubject.next({ 
        status: 'desconectado', 
        lastEvent: 'max_reconnect_attempts' 
      });
      return;
    }

    // Calcular delay con backoff exponencial
    const delay = this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[AuthStreamService] Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect(username);
    }, delay);
  }

  /**
   * Desconectar del stream SSE
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.eventSource) {
      console.log('[AuthStreamService] Cerrando conexión SSE');
      this.eventSource.close();
      this.eventSource = null;
    }

    this.reconnectAttempts = 0;
    this.connectionStatusSubject.next({ status: 'desconectado' });
  }

  /**
   * Verificar si hay una conexión SSE activa
   * @returns true si está conectado
   */
  isConnected(): boolean {
    return this.eventSource !== null && this.eventSource.readyState === EventSource.OPEN;
  }

  /**
   * Obtener estado de la conexión
   * @returns Estado de readyState de EventSource
   */
  getConnectionState(): number {
    return this.eventSource ? this.eventSource.readyState : EventSource.CLOSED;
  }
}
