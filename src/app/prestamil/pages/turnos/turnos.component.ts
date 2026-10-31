import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { TurnoService } from '../../core/services/turno.service';
import { AuthService } from '../../core/services/auth.service';
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-turnos',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './turnos.component.html',
  styleUrls: ['./turnos.component.scss']
})
export class TurnosComponent implements OnInit {
  turno: any = null;
  puedeAbrir = false;
  rolesPermitidosAbrir: number[] = [5]; // gerente id=5 por defecto
  /** CAJ-06: por qué el cierre de caja impide abrir turno hoy (un día pendiente o la caja de hoy cerrada). */
  motivoBloqueoApertura: string | null = null;
  
  successMessage = '';
  errorMessage = '';
  confirmTitle = '';
  confirmMessage = '';
  isLoggingOut = false;

  @ViewChild('confirmModal') confirmModalTemplate!: TemplateRef<any>;

  constructor(
    private turnoService: TurnoService, 
    private authService: AuthService,
    private router: Router,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    const user = this.authService.getUser();
    const idRol = user?.idRol ?? null;
    this.puedeAbrir = idRol != null && this.rolesPermitidosAbrir.indexOf(Number(idRol)) !== -1;

    // cargar turno activo al iniciar
    this.turnoService.currentTurno$.subscribe(t => (this.turno = t));
    this.turnoService.refreshActivo();
    if (this.puedeAbrir) {
      this.revisarApertura();
    }
    
    // Suscribirse al estado de logout
    this.authService.isLoggingOut$.subscribe(isLoggingOut => {
      this.isLoggingOut = isLoggingOut;
    });
  }

  /** Pregunta al servidor si el cierre de caja bloquea la apertura, para avisarlo antes de intentarla. */
  private revisarApertura(): void {
    this.turnoService.apertura().subscribe({
      next: (r) => (this.motivoBloqueoApertura = r.motivoBloqueo),
      // Si no se pudo consultar, la apertura misma responde con el motivo
      error: () => (this.motivoBloqueoApertura = null)
    });
  }

  iniciar() {
    this.confirmTitle = 'Confirmar inicio de turno';
    this.confirmMessage = '¿Está seguro que desea iniciar un nuevo turno?';
    
    const modalRef = this.modalService.open(this.confirmModalTemplate, { centered: true });
    
    modalRef.result.then(
      (result) => {
        if (result === 'confirm') {
          this.turnoService.iniciar().subscribe({ 
            next: () => {
              // Refrescar el menú desde el backend
              this.authService.refreshMenuFromBackend().subscribe({
                next: () => {
                  this.showSuccessMessage('Turno iniciado correctamente');
                  // Recargar la página después de 1.5 segundos para mostrar el mensaje
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                },
                error: (err) => {
                  console.error('Error al refrescar el menú:', err);
                  this.showErrorMessage('Turno iniciado, pero hubo un error al actualizar el menú. Por favor, cierre sesión e inicie sesión nuevamente.');
                }
              });
            }, 
            error: (e) => {
              console.error('Error al iniciar turno:', e);
              // CAJ-06: el servidor explica si la caja de hoy ya se cerró o hay un día pendiente de cierre
              const motivo = e?.status === 400 ? e?.error?.message : null;
              this.showErrorMessage(motivo || 'Error al iniciar turno');
              if (motivo) this.revisarApertura();
            }
          });
        }
      },
      () => {
        // Modal dismissed
      }
    );
  }

  cerrar() {
    if (!this.turno || !this.turno.id) {
      this.showErrorMessage('No hay turno activo');
      return;
    }
    
    this.confirmTitle = 'Confirmar cierre de turno';
    this.confirmMessage = '¿Está seguro que desea cerrar el turno actual?';
    
    const modalRef = this.modalService.open(this.confirmModalTemplate, { centered: true });
    
    modalRef.result.then(
      (result) => {
        if (result === 'confirm') {
          this.turnoService.cerrar(this.turno.id).subscribe({ 
            next: () => {
              // Refrescar el menú desde el backend
              this.authService.refreshMenuFromBackend().subscribe({
                next: () => {
                  this.showSuccessMessage('Turno cerrado correctamente');
                  // Recargar la página después de 1.5 segundos para mostrar el mensaje
                  setTimeout(() => {
                    window.location.reload();
                  }, 1500);
                },
                error: (err) => {
                  // Verificar si es el error de usuario sin menús autorizados
                  console.log('Error recibido:', err);
                  const errorMessage = err?.message || err?.error?.message || String(err);
                  if (errorMessage.includes('USUARIO_SIN_MENUS_AUTORIZADO')) {
                    // El usuario ya fue deslogueado y redirigido, no hacer nada más
                    console.log('Usuario deslogueado automáticamente por falta de menús autorizados');
                  } else {
                    console.error('Error al refrescar el menú:', err);
                    this.showErrorMessage('Turno cerrado, pero hubo un error al actualizar el menú. Por favor, cierre sesión e inicie sesión nuevamente.');
                  }
                }
              });
            }, 
            error: () => {
              this.showErrorMessage('Error al cerrar turno');
            }
          });
        }
      },
      () => {
        // Modal dismissed
      }
    );
  }

  private showSuccessMessage(message: string): void {
    this.successMessage = message;
    // Auto-cerrar después de 3 segundos
    setTimeout(() => {
      this.successMessage = '';
    }, 3000);
  }

  private showErrorMessage(message: string): void {
    this.errorMessage = message;
    // Auto-cerrar después de 5 segundos
    setTimeout(() => {
      this.errorMessage = '';
    }, 5000);
  }
}
