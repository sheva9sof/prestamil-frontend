import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { environment } from 'src/environments/environment';
import { CobroComponent } from 'src/app/prestamil/core/components/cobro/cobro.component';
import { generarRequestId } from 'src/app/prestamil/core/helpers/request-id.helper';
import {
  ContratoOperacionDetalleResponse,
  MovimientoResponse,
  PagoRequest,
  ReposicionRequest
} from 'src/app/prestamil/core/models/contrato.model';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';
import { MovimientoService } from 'src/app/prestamil/core/services/movimiento.service';

/**
 * Reposición/reimpresión de contrato (F9): muestra ramo, contrato, cliente, avalúo, préstamo, % reposición
 * e importe (calculados por el servidor). El botón "Imprimir contrato" pasa por la ventana de Cobro solo
 * si el importe {@literal >} 0 y luego descarga el PDF existente. La casilla "No cobrar la reposición del
 * contrato" solo aparece para roles autorizados (Gerente y Sistemas por defecto); el backend responde
 * 403 si otro rol la envía.
 */
@Component({
  selector: 'app-reposicion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reposicion-modal.component.html',
  styleUrls: ['./reposicion-modal.component.scss']
})
export class ReposicionModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  private modalService = inject(NgbModal);
  private movimientoService = inject(MovimientoService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  /** IDs de rol del seed que pueden exentar (deben coincidir con configuracion). */
  private readonly ROLES_PUEDEN_EXENTAR = [1 /* Sistemas */, 5 /* Gerente */];

  noCobrar = false;
  comentario = '';
  procesando = false;
  errorMessage = '';

  get puedeExentar(): boolean {
    const idRol = this.authService.getUser()?.idRol;
    return idRol != null && this.ROLES_PUEDEN_EXENTAR.includes(idRol);
  }

  get importe(): number {
    if (this.noCobrar) return 0;
    return this.contrato.importeReposicion ?? 0;
  }

  get plazoNoHabilitaReposicion(): boolean {
    return !this.contrato.cobrarReposicionContrato;
  }

  imprimir(): void {
    if (this.procesando || this.plazoNoHabilitaReposicion) return;
    this.procesando = true;
    this.errorMessage = '';
    const requestId = generarRequestId();

    // Sin importe (exento o plazo con monto 0) se registra directo y se descarga el PDF; con importe se
    // pasa por la ventana de Cobro (RN-24) y hasta que cuadre se registra.
    if (this.importe <= 0) {
      this.registrar(requestId, undefined);
      return;
    }
    this.cobrar(requestId);
  }

  private cobrar(requestId: string): void {
    const ref = this.modalService.open(CobroComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      windowClass: 'cobro-modal'
    });
    const cobro = ref.componentInstance as CobroComponent;
    cobro.total = this.importe;
    cobro.totalConLetra = '';
    cobro.concepto = 'Reposición de contrato';
    cobro.folioContrato = this.contrato.folio;
    cobro.procesar = (pago: PagoRequest) =>
      this.movimientoService.cobrarReposicion(this.contrato.id, this.buildRequest(requestId, pago));

    ref.result.then(
      (movimiento: MovimientoResponse) => this.tras(movimiento),
      () => {
        // Cobro cancelado: nada se registró; el modal de reposición sigue abierto
        this.procesando = false;
      }
    );
  }

  private registrar(requestId: string, pago: PagoRequest | undefined): void {
    this.movimientoService.cobrarReposicion(this.contrato.id, this.buildRequest(requestId, pago)).subscribe({
      next: (movimiento) => this.tras(movimiento),
      error: (err) => {
        this.procesando = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo registrar la reposición.';
      }
    });
  }

  private buildRequest(requestId: string, pago: PagoRequest | undefined): ReposicionRequest {
    return {
      noCobrar: this.noCobrar,
      comentario: this.comentario?.trim() || undefined,
      pago,
      requestId
    };
  }

  /** Registro OK → descarga el PDF de contrato existente y cierra el modal. */
  private tras(movimiento: MovimientoResponse): void {
    this.http
      .get(`${environment.apiUrl}/api/contratos/${this.contrato.id}/pdf`, { responseType: 'blob' })
      .subscribe({
        next: (pdf) => {
          const url = URL.createObjectURL(pdf);
          window.open(url, '_blank');
          // El navegador conserva la referencia mientras el visor está abierto; el revoke se puede diferir
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          this.activeModal.close(movimiento);
        },
        error: () => {
          // El movimiento ya quedó registrado en caja aunque falle la descarga: no se cobra dos veces
          this.errorMessage = 'La reposición se registró, pero no se pudo abrir el PDF del contrato.';
          this.procesando = false;
        }
      });
  }
}
