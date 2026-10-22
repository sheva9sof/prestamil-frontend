import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CobroComponent } from 'src/app/prestamil/core/components/cobro/cobro.component';
import { generarRequestId } from 'src/app/prestamil/core/helpers/request-id.helper';
import {
  ContratoOperacionDetalleResponse,
  CotizacionMovimientoResponse,
  MovimientoResponse
} from 'src/app/prestamil/core/models/contrato.model';
import { MovimientoService } from 'src/app/prestamil/core/services/movimiento.service';

/**
 * Refrendar contrato (F3): cotiza a la fecha del servidor, muestra el desglose y abre la ventana de
 * Cobro. Se cierra con el movimiento registrado; quien lo abrió muestra el ticket y refresca. El tipo
 * (RF o RPG si está en periodo de gracia) lo decide el backend.
 */
@Component({
  selector: 'app-refrendo-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './refrendo-modal.component.html',
  styleUrls: ['./refrendo-modal.component.scss']
})
export class RefrendoModalComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private modalService = inject(NgbModal);
  private movimientoService = inject(MovimientoService);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  cotizacion: CotizacionMovimientoResponse | null = null;
  isLoading = false;
  errorMessage = '';
  cobrando = false;

  get enGracia(): boolean {
    return this.cotizacion?.tipoMovimiento === 'RPG';
  }

  get extemporaneo(): boolean {
    return this.cotizacion?.tipoMovimiento === 'RX';
  }

  get concepto(): string {
    if (this.enGracia) return 'Refrendo en periodo de gracia';
    if (this.extemporaneo) return 'Refrendo extemporáneo';
    return 'Refrendo de contrato';
  }

  ngOnInit(): void {
    this.cotizar();
  }

  cotizar(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.movimientoService.cotizar({ contratoId: this.contrato.id, tipoOperacion: 'REFRENDO' }).subscribe({
      next: (cotizacion) => {
        this.cotizacion = cotizacion;
        this.isLoading = false;
      },
      error: (err) => {
        this.cotizacion = null;
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo cotizar el refrendo.';
      }
    });
  }

  cobrar(): void {
    const cotizacion = this.cotizacion;
    if (!cotizacion || this.cobrando) return;
    this.cobrando = true;

    // Un mismo id para todos los reintentos de esta ventana de Cobro: si la respuesta se pierde y el
    // cajero vuelve a guardar, el backend devuelve el refrendo ya registrado en vez de cobrar dos veces
    const requestId = generarRequestId();
    const ref = this.modalService.open(CobroComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      windowClass: 'cobro-modal'
    });
    const cobro = ref.componentInstance as CobroComponent;
    cobro.total = cotizacion.total;
    cobro.totalConLetra = cotizacion.totalConLetra;
    cobro.concepto = this.concepto;
    cobro.folioContrato = cotizacion.folio;
    cobro.procesar = (pago) =>
      this.movimientoService.registrar({
        contratoId: cotizacion.contratoId,
        tipoOperacion: 'REFRENDO',
        pago,
        requestId,
        totalCotizado: cotizacion.total
      });

    ref.result.then(
      (movimiento: MovimientoResponse) => this.activeModal.close(movimiento),
      () => {
        // Cobro cancelado: se vuelve a cotizar por si cambió el día o el importe
        this.cobrando = false;
        this.cotizar();
      }
    );
  }
}
