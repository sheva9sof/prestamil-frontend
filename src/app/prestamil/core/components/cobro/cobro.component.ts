import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { Banco } from '../../models/banco.model';
import { PagoRequest, TipoTarjeta } from '../../models/contrato.model';
import { BancoService } from '../../services/banco.service';

/**
 * Ventana de Cobro de COCAE (RN-24), común a refrendos, finiquitos, abonos, parciales y reposición.
 * Captura efectivo y/o tarjeta, calcula el cambio y solo deja guardar cuando el pago cuadra. Se abre
 * con NgbModal: quien la abre pasa el total y la función que registra el movimiento; el modal se cierra
 * con lo que devuelva esa función. El backend repite todas las validaciones.
 */
@Component({
  selector: 'app-cobro',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cobro.component.html',
  styleUrls: ['./cobro.component.scss']
})
export class CobroComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private bancoService = inject(BancoService);

  /** Total a cobrar, calculado por el backend. */
  @Input() total = 0;
  @Input() totalConLetra = '';
  /** Concepto del cobro, p. ej. "Refrendo en periodo de gracia". */
  @Input() concepto = '';
  @Input() folioContrato = '';
  /** Registra el movimiento con la forma de pago capturada. */
  @Input() procesar!: (pago: PagoRequest) => Observable<unknown>;

  bancos: Banco[] = [];
  bancosError = '';

  efectivo: number | null = null;
  tarjeta: number | null = null;
  tipoTarjeta: TipoTarjeta | null = null;
  tarjetaUltimos4 = '';
  bancoEmisorId: number | null = null;
  autorizacion = '';

  guardando = false;
  errorMessage = '';

  ngOnInit(): void {
    this.bancoService.listar(true).subscribe({
      next: (bancos) => (this.bancos = bancos),
      error: () => (this.bancosError = 'No se pudo cargar el catálogo de bancos.')
    });
  }

  get usaTarjeta(): boolean {
    return this.centavos(this.tarjeta) > 0;
  }

  get totalRecibido(): number {
    return (this.centavos(this.efectivo) + this.centavos(this.tarjeta)) / 100;
  }

  get cambio(): number {
    return Math.max(0, this.centavos(this.efectivo) + this.centavos(this.tarjeta) - this.centavos(this.total)) / 100;
  }

  /** Por qué todavía no se puede guardar; null si el cobro cuadra. */
  get motivoInvalido(): string | null {
    if ((this.efectivo ?? 0) < 0 || (this.tarjeta ?? 0) < 0) {
      return 'Los importes no pueden ser negativos.';
    }
    // El cambio solo sale del efectivo
    if (this.centavos(this.tarjeta) > this.centavos(this.total)) {
      return 'El importe con tarjeta no puede ser mayor al total.';
    }
    const faltante = this.centavos(this.total) - this.centavos(this.efectivo) - this.centavos(this.tarjeta);
    if (faltante > 0) {
      return `Faltan $${(faltante / 100).toFixed(2)} para cubrir el total.`;
    }
    if (this.usaTarjeta) {
      if (!this.tipoTarjeta) return 'Indique si la tarjeta es de crédito o de débito.';
      if (!/^\d{4}$/.test(this.tarjetaUltimos4)) return 'Capture los últimos 4 dígitos de la tarjeta.';
      if (!this.bancoEmisorId) return 'Seleccione el banco emisor.';
      if (!this.autorizacion.trim()) return 'Capture el número de autorización.';
    }
    return null;
  }

  /** Completa con efectivo lo que no se paga con tarjeta. */
  pagoExacto(): void {
    this.efectivo = Math.max(0, this.centavos(this.total) - this.centavos(this.tarjeta)) / 100;
  }

  /** Solo dígitos en los últimos 4 de la tarjeta. */
  limpiarUltimos4(valor: string): void {
    this.tarjetaUltimos4 = (valor ?? '').replace(/\D/g, '').slice(0, 4);
  }

  guardar(): void {
    if (this.guardando || this.motivoInvalido) return;
    this.guardando = true;
    this.errorMessage = '';
    const pago: PagoRequest = {
      efectivo: this.centavos(this.efectivo) / 100,
      tarjeta: this.centavos(this.tarjeta) / 100
    };
    if (this.usaTarjeta) {
      pago.tipoTarjeta = this.tipoTarjeta ?? undefined;
      pago.tarjetaUltimos4 = this.tarjetaUltimos4;
      pago.bancoEmisorId = this.bancoEmisorId ?? undefined;
      pago.autorizacion = this.autorizacion.trim();
    }
    this.procesar(pago).subscribe({
      next: (resultado) => this.activeModal.close(resultado),
      error: (err) => {
        this.guardando = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo registrar el cobro.';
      }
    });
  }

  cancelar(): void {
    if (!this.guardando) this.activeModal.dismiss();
  }

  /** Importes en centavos para no acumular errores de punto flotante. */
  private centavos(valor: number | null): number {
    return Math.round((Number(valor) || 0) * 100);
  }
}
