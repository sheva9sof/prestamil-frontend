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
 * Finiquitar contrato (F4): cotiza a la fecha del servidor, muestra el desglose (capital + interes −
 * descuento parametrizado + IVA) y abre la ventana de Cobro. Al guardar, el backend cierra el
 * contrato (FINIQUITADO), pone saldo_capital = 0 y sus partidas a FIN en una sola transacción.
 * El descuento sale de la parametrización (RN-27); el cajero no lo captura.
 */
@Component({
  selector: 'app-finiquito-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './finiquito-modal.component.html',
  styleUrls: ['./finiquito-modal.component.scss']
})
export class FiniquitoModalComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private modalService = inject(NgbModal);
  private movimientoService = inject(MovimientoService);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  cotizacion: CotizacionMovimientoResponse | null = null;
  isLoading = false;
  errorMessage = '';
  cobrando = false;

  get extemporaneo(): boolean {
    return this.cotizacion?.tipoMovimiento === 'FX';
  }

  get concepto(): string {
    return this.extemporaneo ? 'Finiquito extemporáneo' : 'Finiquito de contrato';
  }

  ngOnInit(): void {
    this.cotizar();
  }

  cotizar(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.movimientoService.cotizar({ contratoId: this.contrato.id, tipoOperacion: 'FINIQUITO' }).subscribe({
      next: (cotizacion) => {
        this.cotizacion = cotizacion;
        this.isLoading = false;
      },
      error: (err) => {
        this.cotizacion = null;
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo cotizar el finiquito.';
      }
    });
  }

  cobrar(): void {
    const cotizacion = this.cotizacion;
    if (!cotizacion || this.cobrando) return;
    this.cobrando = true;

    // Un mismo id para todos los reintentos de esta ventana de Cobro: si la respuesta se pierde y el
    // cajero vuelve a guardar, el backend devuelve el finiquito ya registrado en vez de cobrar dos veces
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
        tipoOperacion: 'FINIQUITO',
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
