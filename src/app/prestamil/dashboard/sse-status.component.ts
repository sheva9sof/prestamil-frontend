import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthStreamService } from '../core/services/auth-stream.service';
import { AuthService } from '../core/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';

/**
 * Componente de diagnóstico para monitorear el estado de la conexión SSE
 * Muestra en tiempo real el estado de la conexión y los eventos recibidos
 */
@Component({
  selector: 'app-sse-status',
  standalone: true,
  imports: [CommonModule, SharedModule, RouterModule],
  templateUrl: './sse-status.component.html',
  styleUrls: ['./sse-status.component.scss']
})
export class SseStatusComponent implements OnInit, OnDestroy {
  private authStreamService = inject(AuthStreamService);
  private authService = inject(AuthService);
  private sseSubscription?: Subscription;

  // Estado visible en el template
  sseStatus = 'desconectado';
  sseLastEvent = '';
  currentUser: any;
  connectionHistory: Array<{ timestamp: string; event: string; status: string }> = [];
  isConnected = false;
  maxHistorySize = 10;

  // Estilos dinámicos según estado
  get statusBadgeClass(): string {
    switch (this.sseStatus) {
      case 'conectado':
        return 'badge bg-success';
      case 'error':
        return 'badge bg-danger';
      case 'force-logout':
        return 'badge bg-warning';
      default:
        return 'badge bg-secondary';
    }
  }

  get statusIcon(): string {
    switch (this.sseStatus) {
      case 'conectado':
        return 'feather icon-check-circle text-success';
      case 'error':
        return 'feather icon-x-circle text-danger';
      case 'force-logout':
        return 'feather icon-alert-triangle text-warning';
      default:
        return 'feather icon-circle text-secondary';
    }
  }

  ngOnInit(): void {
    // Obtener usuario actual
    this.currentUser = this.authService.getUser();

    // Suscribirse a cambios de estado SSE
    this.sseSubscription = this.authStreamService.connectionStatus$.subscribe(status => {
      this.sseStatus = status.status;
      this.sseLastEvent = status.lastEvent || '';
      this.isConnected = this.sseStatus === 'conectado';

      // Agregar a historial
      this.addToHistory(status.status, status.lastEvent);

      console.log('[SseStatusComponent] Estado SSE actualizado:', this.sseStatus);
    });
  }

  ngOnDestroy(): void {
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
    }
  }

  /**
   * Agregar evento al historial
   */
  private addToHistory(status: string, event?: string): void {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    this.connectionHistory.unshift({
      timestamp,
      event: event || status,
      status
    });

    // Mantener solo los últimos N eventos
    if (this.connectionHistory.length > this.maxHistorySize) {
      this.connectionHistory = this.connectionHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Reconectar manualmente SSE
   */
  reconnectSSE(): void {
    if (this.currentUser && this.currentUser.nombreUsuario) {
      console.log('[SseStatusComponent] Reconectando SSE manualmente...');
      this.authStreamService.disconnect();
      setTimeout(() => {
        this.authStreamService.connect(this.currentUser.nombreUsuario);
      }, 500);
    }
  }

  /**
   * Desconectar SSE manualmente
   */
  disconnectSSE(): void {
    console.log('[SseStatusComponent] Desconectando SSE manualmente...');
    this.authStreamService.disconnect();
  }

  /**
   * Limpiar historial
   */
  clearHistory(): void {
    this.connectionHistory = [];
  }

  /**
   * Obtener clase CSS para item de historial según su estado
   */
  getHistoryItemClass(status: string): string {
    switch (status) {
      case 'conectado':
        return 'list-group-item-success';
      case 'error':
        return 'list-group-item-danger';
      case 'force-logout':
        return 'list-group-item-warning';
      default:
        return '';
    }
  }
}
