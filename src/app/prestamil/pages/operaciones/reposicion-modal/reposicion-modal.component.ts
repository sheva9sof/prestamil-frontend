import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CobroComponent } from 'src/app/prestamil/core/components/cobro/cobro.component';
import { PdfVisorComponent } from 'src/app/prestamil/core/components/pdf-visor/pdf-visor.component';
import { TicketVisorComponent } from 'src/app/prestamil/core/components/ticket-visor/ticket-visor.component';
import { generarRequestId } from 'src/app/prestamil/core/helpers/request-id.helper';
import {
  ContratoOperacionDetalleResponse,
  MovimientoResponse,
  PagoRequest,
  ReposicionRequest
} from 'src/app/prestamil/core/models/contrato.model';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';
import { ContratoService } from 'src/app/prestamil/core/services/contrato.service';
import { MovimientoService } from 'src/app/prestamil/core/services/movimiento.service';

/**
 * Reposición/reimpresión de contrato (F9 + C-02): muestra ramo, contrato, cliente, avalúo, préstamo,
 * % reposición e importe. Flujo secuencial cobro → ticket → contrato: tras registrar el RE se abre el
 * ticket; solo cuando el usuario cierra el ticket se abre el visor del contrato, que lo descarga por
 * {@code GET /api/contratos/{id}/pdf-reposicion} (exige un RE no cancelado del día). Así no se
 * puede entregar el contrato sin que el ticket haya salido primero. La casilla "No cobrar" solo
 * aparece para Gerente y Sistemas; el backend responde 403 si otro rol la envía.
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
  private contratoService = inject(ContratoService);

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

  /**
   * Flujo secuencial C-02: tras registrar el RE se muestra el ticket; cuando el usuario lo cierra,
   * recién entonces se abre el visor del contrato. El backend rechaza con 409 si el RE no está
   * registrado, así que la primera llamada después del ticket siempre lo tendrá.
   */
  private tras(movimiento: MovimientoResponse): void {
    const ticketRef = this.modalService.open(TicketVisorComponent, {
      centered: true,
      scrollable: true,
      backdrop: 'static',
      keyboard: false
    });
    const visor = ticketRef.componentInstance as TicketVisorComponent;
    visor.movimientoId = movimiento.id;
    visor.titulo = `Nota ${movimiento.folioNota ?? ''} · Reposición contrato ${movimiento.folioContrato}`;
    visor.mensaje = movimiento.monto > 0
      ? `Reposición cobrada por $${movimiento.monto.toFixed(2)}. Entregue el ticket al cliente antes de imprimir el contrato.`
      : 'Reposición exenta registrada. Entregue el ticket antes de imprimir el contrato.';

    ticketRef.result.then(
      () => this.abrirContrato(movimiento),
      () => this.abrirContrato(movimiento)
    );
  }

  /**
   * Muestra el PDF del contrato en un visor modal. Se llama solo tras cerrar el ticket, para que el
   * personal no entregue el contrato antes de que el ticket salga. Al cerrar el visor se cierra también
   * este modal, aunque la descarga haya fallado: el RE ya quedó registrado en caja y volver a pulsar
   * "Imprimir contrato" lo cobraría dos veces (el visor tiene su propio botón de reintentar).
   */
  private abrirContrato(movimiento: MovimientoResponse): void {
    const visorRef = this.modalService.open(PdfVisorComponent, {
      size: 'xl',
      scrollable: true,
      backdrop: 'static',
      keyboard: false
    });
    const visor = visorRef.componentInstance as PdfVisorComponent;
    visor.pdf$ = this.contratoService.getPdfReposicion(this.contrato.id);
    visor.titulo = `Contrato ${this.contrato.folio}`;
    visor.nombreArchivo = `contrato-${this.contrato.folio}.pdf`;

    visorRef.result.then(
      () => this.activeModal.close(movimiento),
      () => this.activeModal.close(movimiento)
    );
  }
}
