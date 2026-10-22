import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
 * Refrendo parcial (F7, RN-14): el cajero elige cuántos periodos cubrir con el máximo en
 * transcurridos − 1. La cotización se pide al backend a la fecha del servidor; si el capturado excede
 * el máximo el servidor devuelve el ajuste como advertencia y lo mostramos. Se cubren primero los
 * extemporáneos (RN-14) y la sanción solo por ellos. Aceptar abre la ventana de Cobro; el backend
 * decide RP o RPX según haya extemporáneos cubiertos.
 */
@Component({
  selector: 'app-refrendo-parcial-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './refrendo-parcial-modal.component.html',
  styleUrls: ['./refrendo-parcial-modal.component.scss']
})
export class RefrendoParcialModalComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private modalService = inject(NgbModal);
  private movimientoService = inject(MovimientoService);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  /** Cotización de "pagar todo" (REFRENDO / RX): estado actual del contrato hoy. */
  estadoActual: CotizacionMovimientoResponse | null = null;
  /** Cotización del parcial vigente con los periodos capturados. Null hasta que el cajero captura. */
  cotizacion: CotizacionMovimientoResponse | null = null;

  periodosCapturados: number | null = null;
  isLoading = false;
  isRecotizando = false;
  errorEstado = '';
  errorCotizacion = '';
  cobrando = false;

  get maxPeriodos(): number {
    return Math.max(0, (this.estadoActual?.periodosTranscurridos ?? 0) - 1);
  }

  /**
   * D-03 (RN-31): mínimo capturable. En VIGENTE/EN_GRACIA es 1; en VENCIDO/EN_VENTA es
   * extemporáneos + 1 (el backend lo devuelve en {@code periodosMinimos} de la cotización del parcial;
   * mientras no haya cotización usamos la derivación local sobre el estado actual).
   */
  get minPeriodos(): number {
    if (this.cotizacion?.periodosMinimos != null) {
      return this.cotizacion.periodosMinimos;
    }
    const e = this.estadoActual;
    if (!e) return 1;
    const esExtemporaneo =
      e.estatusActual === 'VENCIDO' || e.estatusActual === 'EN_VENTA';
    return esExtemporaneo ? (e.periodosExtemporaneos ?? 0) + 1 : 1;
  }

  /** El campo deja de ser editable solo cuando únicamente cabe un valor (maximo = minimo). */
  get campoEditable(): boolean {
    return this.maxPeriodos > this.minPeriodos;
  }

  get advertencias(): string[] {
    return this.cotizacion?.advertencias ?? [];
  }

  /** El n mostrado y el n cotizado coinciden: condición para habilitar "Aceptar". */
  get periodosValidos(): boolean {
    return (
      this.cotizacion !== null &&
      this.periodosCapturados !== null &&
      this.periodosCapturados === this.cotizacion.periodosAplicados &&
      this.periodosCapturados >= this.minPeriodos &&
      this.periodosCapturados <= this.maxPeriodos
    );
  }

  ngOnInit(): void {
    this.cargarEstadoActual();
  }

  /**
   * Estado actual = cotización de refrendo completo (todos los transcurridos). Es también el "total
   * si pagara todo" y trae interés, sanción total, subtotal e IVA para el bloque superior.
   */
  private cargarEstadoActual(): void {
    this.isLoading = true;
    this.errorEstado = '';
    // REFRENDO se mapea a REFRENDO / REFRENDO_EXTEMPORANEO según estatus; ambos sirven como "estado".
    this.movimientoService
      .cotizar({ contratoId: this.contrato.id, tipoOperacion: 'REFRENDO' })
      .subscribe({
        next: (cot) => {
          this.estadoActual = cot;
          this.isLoading = false;
          // D-01: el campo no puede verse "readonly" al abrir; sembramos el máximo y recotizamos
          // para que el cajero vea el preview sin tener que teclear.
          if (this.periodosCapturados === null && this.maxPeriodos >= this.minPeriodos) {
            this.periodosCapturados = this.maxPeriodos;
            this.recotizar();
          }
        },
        error: (err) => {
          this.isLoading = false;
          this.errorEstado = err?.error?.message ?? 'No se pudo obtener el estado del contrato.';
        }
      });
  }

  /** Al salir del campo (blur) o Enter: recotiza con el capturado. */
  recotizar(): void {
    const n = this.periodosCapturados;
    if (n === null || n === undefined || isNaN(Number(n)) || n < 1) {
      this.cotizacion = null;
      this.errorCotizacion = '';
      return;
    }
    this.isRecotizando = true;
    this.errorCotizacion = '';
    this.movimientoService
      .cotizar({
        contratoId: this.contrato.id,
        tipoOperacion: 'REFRENDO_PARCIAL',
        periodos: Math.trunc(n)
      })
      .subscribe({
        next: (cot) => {
          this.isRecotizando = false;
          this.cotizacion = cot;
          // Si el servidor ajustó al máximo, refleja el número real en el input.
          if (cot.periodosAplicados !== Math.trunc(n)) {
            this.periodosCapturados = cot.periodosAplicados;
          }
        },
        error: (err) => {
          this.isRecotizando = false;
          this.cotizacion = null;
          this.errorCotizacion = err?.error?.message ?? 'No se pudo cotizar el refrendo parcial.';
        }
      });
  }

  onEnter(event: Event): void {
    event.preventDefault();
    // blur dispara la recotización mediante el (blur) del input
    (event.target as HTMLInputElement).blur();
  }

  cobrar(): void {
    const cotizacion = this.cotizacion;
    if (!cotizacion || !this.periodosValidos || this.cobrando) return;
    this.cobrando = true;

    // Un mismo id para todos los reintentos de esta ventana de Cobro: si la respuesta se pierde y el
    // cajero vuelve a guardar, el backend devuelve el parcial ya registrado en vez de cobrar dos veces
    const requestId = generarRequestId();
    // D-01: enviamos el n mostrado (= cotizacion.periodosAplicados, verificado por periodosValidos).
    // Si el usuario cambia el input sin recotizar, periodosValidos vuelve a false y Aceptar queda
    // deshabilitado; si llega al backend un n distinto, responde 409.
    const periodos = cotizacion.periodosAplicados;
    const ref = this.modalService.open(CobroComponent, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      windowClass: 'cobro-modal'
    });
    const cobro = ref.componentInstance as CobroComponent;
    cobro.total = cotizacion.total;
    cobro.totalConLetra = cotizacion.totalConLetra;
    cobro.concepto =
      cotizacion.tipoMovimiento === 'RPX' ? 'Refrendo parcial extemporáneo' : 'Refrendo parcial';
    cobro.folioContrato = cotizacion.folio;
    cobro.procesar = (pago) =>
      this.movimientoService.registrar({
        contratoId: cotizacion.contratoId,
        tipoOperacion: 'REFRENDO_PARCIAL',
        periodos,
        pago,
        requestId,
        totalCotizado: cotizacion.total
      });

    ref.result.then(
      (movimiento: MovimientoResponse) => this.activeModal.close(movimiento),
      () => {
        // Cobro cancelado: recotiza por si cambió el día o el importe
        this.cobrando = false;
        this.cargarEstadoActual();
        this.recotizar();
      }
    );
  }
}
