import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { CobroComponent } from 'src/app/prestamil/core/components/cobro/cobro.component';
import { generarRequestId } from 'src/app/prestamil/core/helpers/request-id.helper';
import {
  ContratoOperacionDetalleResponse,
  CotizacionMovimientoResponse,
  MovimientoResponse
} from 'src/app/prestamil/core/models/contrato.model';
import { MovimientoService } from 'src/app/prestamil/core/services/movimiento.service';

const ABONO_MINIMO = 20;

/**
 * Abono a capital (F5, RN-13): refrendo con abono. Cotiza contra el mismo endpoint que refrendar
 * (tipoOperacion=ABONO_CAPITAL) y recotiza en vivo al cambiar el campo de abono con debounce. Al
 * aceptar abre la ventana de Cobro; el backend valida mínimo $20, que el abono sea menor al saldo
 * (si es mayor o igual, dice "use Finiquitar") y que el contrato no esté vencido.
 */
@Component({
  selector: 'app-abono-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './abono-modal.component.html',
  styleUrls: ['./abono-modal.component.scss']
})
export class AbonoModalComponent implements OnInit, OnDestroy {
  readonly activeModal = inject(NgbActiveModal);
  private modalService = inject(NgbModal);
  private movimientoService = inject(MovimientoService);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  /** Importe por refrendo (interés + IVA, sin abono). No cambia con el capturado. */
  cotizacionBase: CotizacionMovimientoResponse | null = null;
  /** Cotización vigente con el abono capturado; cae a la base si el abono no es válido. */
  cotizacion: CotizacionMovimientoResponse | null = null;

  abonoCapital: number | null = null;
  isLoading = false;
  isRecotizando = false;
  errorMessage = '';
  cobrando = false;

  private cambios = new Subject<number>();
  private cambiosSub?: Subscription;

  get enGracia(): boolean {
    return this.cotizacionBase?.estatusActual === 'EN_GRACIA';
  }

  /** El campo del cajero. Devuelve el mensaje de error si el importe capturado no es válido. */
  get errorAbono(): string {
    const abono = this.abonoCapital;
    if (abono === null || abono === undefined) return '';
    if (isNaN(Number(abono))) return 'Capture un importe válido.';
    if (abono < ABONO_MINIMO) return `El abono mínimo es $${ABONO_MINIMO.toFixed(2)}.`;
    const saldo = this.cotizacionBase?.saldoCapital ?? 0;
    if (abono >= saldo) return 'El abono cubre todo el saldo; use Finiquitar.';
    return '';
  }

  get abonoValido(): boolean {
    return this.abonoCapital !== null && this.abonoCapital >= ABONO_MINIMO && !this.errorAbono;
  }

  /** Importe por refrendo puro (sin abono): interés + IVA. Se toma de la cotización base. */
  get importePorRefrendo(): number {
    if (!this.cotizacionBase) return 0;
    return this.cotizacionBase.total - this.cotizacionBase.abonoCapital;
  }

  get saldoQueQueda(): number {
    if (!this.cotizacionBase) return 0;
    const saldo = this.cotizacionBase.saldoCapital;
    if (!this.abonoValido || this.abonoCapital === null) return saldo;
    return saldo - this.abonoCapital;
  }

  ngOnInit(): void {
    // La primera cotización trae el importe por refrendo y el estatus/gracia. Se pide con abono = 0
    // para que el backend valide contra la matriz RN-16 (rechaza vencido). El campo empieza vacío
    // para que el cajero capture y solo entonces el importe a cobrar crezca con el abono.
    this.cotizar(0, true);

    this.cambiosSub = this.cambios
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((abono) => {
          this.isRecotizando = true;
          return this.movimientoService
            .cotizar({
              contratoId: this.contrato.id,
              tipoOperacion: 'ABONO_CAPITAL',
              abonoCapital: abono
            })
            .pipe(
              catchError((err) => {
                this.errorMessage = err?.error?.message ?? 'No se pudo recotizar el abono.';
                return of(null);
              })
            );
        })
      )
      .subscribe((cotizacion) => {
        this.isRecotizando = false;
        if (cotizacion) {
          this.cotizacion = cotizacion;
          this.errorMessage = '';
        }
      });
  }

  ngOnDestroy(): void {
    this.cambiosSub?.unsubscribe();
    this.cambios.complete();
  }

  onAbonoChange(): void {
    // Sin capturar o inválido: el importe a cobrar vuelve al del refrendo puro y no se llama al backend
    if (!this.abonoValido || this.abonoCapital === null) {
      this.cotizacion = this.cotizacionBase;
      return;
    }
    this.cambios.next(this.abonoCapital);
  }

  /**
   * Cotiza el refrendo con abono en el servidor. Se llama al abrir (con abono 0 para fijar la base)
   * y tras cancelar el Cobro (por si cambió el día). No la usa el debounce; ese va directo al
   * observable para evitar carreras.
   */
  private cotizar(abono: number, esBase: boolean): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.movimientoService
      .cotizar({
        contratoId: this.contrato.id,
        tipoOperacion: 'ABONO_CAPITAL',
        abonoCapital: abono
      })
      .subscribe({
        next: (cotizacion) => {
          this.isLoading = false;
          if (esBase) {
            this.cotizacionBase = cotizacion;
          }
          this.cotizacion = cotizacion;
        },
        error: (err) => {
          this.isLoading = false;
          this.cotizacionBase = null;
          this.cotizacion = null;
          this.errorMessage = err?.error?.message ?? 'No se pudo cotizar el abono a capital.';
        }
      });
  }

  cobrar(): void {
    const cotizacion = this.cotizacion;
    if (!cotizacion || !this.abonoValido || this.cobrando) return;
    this.cobrando = true;

    // Un mismo id para todos los reintentos de esta ventana de Cobro: si la respuesta se pierde y el
    // cajero vuelve a guardar, el backend devuelve el abono ya registrado en vez de cobrar dos veces
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
    cobro.concepto = 'Abono a capital';
    cobro.folioContrato = cotizacion.folio;
    cobro.procesar = (pago) =>
      this.movimientoService.registrar({
        contratoId: cotizacion.contratoId,
        tipoOperacion: 'ABONO_CAPITAL',
        abonoCapital: this.abonoCapital ?? 0,
        pago,
        requestId,
        totalCotizado: cotizacion.total
      });

    ref.result.then(
      (movimiento: MovimientoResponse) => this.activeModal.close(movimiento),
      () => {
        // Cobro cancelado: la cotización puede haber quedado obsoleta si cambió el día
        this.cobrando = false;
        if (this.abonoValido && this.abonoCapital !== null) {
          this.cotizar(this.abonoCapital, false);
        } else {
          this.cotizar(0, true);
        }
      }
    );
  }
}
