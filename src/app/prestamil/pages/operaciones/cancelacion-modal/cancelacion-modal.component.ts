import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MovimientoService } from 'src/app/prestamil/core/services/movimiento.service';
import {
  ContratoOperacionDetalleResponse,
  EstatusContrato,
  MovimientoResponse,
  TipoMovimiento
} from 'src/app/prestamil/core/models/contrato.model';

const NOMBRE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  EMP: 'Empeño',
  RF: 'Refrendo',
  RPG: 'Refrendo en periodo de gracia',
  RC: 'Refrendo con abono a capital',
  RP: 'Refrendo parcial',
  RPX: 'Refrendo parcial extemporáneo',
  RX: 'Refrendo extemporáneo',
  FI: 'Finiquito',
  FX: 'Finiquito extemporáneo',
  RE: 'Reposición de contrato',
  PV: 'Pase a venta',
  PVA: 'Pase a venta anticipado',
  RM: 'Pago de remanente'
};

const COLOR_MOVIMIENTO: Record<TipoMovimiento, string> = {
  EMP: '#212529',
  RF: '#2e7d32',
  RPG: '#1565c0',
  RC: '#6a1b9a',
  RP: '#00897b',
  RPX: '#ef6c00',
  RX: '#d84315',
  FI: '#0d47a1',
  FX: '#b71c1c',
  RE: '#616161',
  PV: '#9e9e9e',
  PVA: '#9e9e9e',
  RM: '#5d4037'
};

/**
 * Modal de cancelación de movimientos (F10, RN-26). Equivalente a la ventana "Cancelación" de COCAE
 * pero genérica: como cada movimiento guarda su estado anterior (F0), un solo modal cubre RF, RPG,
 * RC, RP, RPX, RX, FI, FX y RE. Carga el último movimiento vigente del contrato, muestra el diff que
 * se restaurará y pide un motivo obligatorio (texto libre, mín. 10 caracteres, RN-26).
 */
@Component({
  selector: 'app-cancelacion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cancelacion-modal.component.html',
  styleUrls: ['./cancelacion-modal.component.scss']
})
export class CancelacionModalComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private movimientoService = inject(MovimientoService);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  ultimo: MovimientoResponse | null = null;
  isLoading = true;
  loadError = '';

  motivo = '';
  isCancelando = false;
  cancelarError = '';

  ngOnInit(): void {
    this.movimientoService.getMovimientos(this.contrato.id).subscribe({
      next: (movs) => {
        // Último vigente distinto de EMP y RE. RE queda fuera por C-03: las reposiciones no se
        // cancelan y tampoco cuentan al decidir cuál es el último movimiento cancelable.
        for (let i = movs.length - 1; i >= 0; i--) {
          const m = movs[i];
          if (!m.cancelado && m.tipo !== 'EMP' && m.tipo !== 'RE') {
            this.ultimo = m;
            break;
          }
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = err?.error?.message ?? 'No se pudo cargar el historial del contrato.';
      }
    });
  }

  /** Solo se cancelan movimientos del día en curso (RN-26). */
  get esDeHoy(): boolean {
    if (!this.ultimo) return false;
    const hoy = new Date();
    const fecha = new Date(this.ultimo.fecha);
    return (
      fecha.getFullYear() === hoy.getFullYear() &&
      fecha.getMonth() === hoy.getMonth() &&
      fecha.getDate() === hoy.getDate()
    );
  }

  get puedeConfirmar(): boolean {
    return !!this.ultimo && this.esDeHoy && this.motivo.trim().length >= 10 && !this.isCancelando;
  }

  confirmar(): void {
    if (!this.puedeConfirmar || !this.ultimo) return;
    this.isCancelando = true;
    this.cancelarError = '';
    this.movimientoService.cancelar(this.ultimo.id, { motivo: this.motivo.trim() }).subscribe({
      next: (movimiento) => {
        this.isCancelando = false;
        this.activeModal.close(movimiento);
      },
      error: (err) => {
        this.isCancelando = false;
        this.cancelarError = err?.error?.message ?? 'No se pudo cancelar el movimiento.';
      }
    });
  }

  etiqueta(tipo: TipoMovimiento): string {
    return NOMBRE_MOVIMIENTO[tipo] ?? tipo;
  }

  color(tipo: TipoMovimiento): string {
    return COLOR_MOVIMIENTO[tipo] ?? '#212529';
  }

  etiquetaEstatus(estatus: EstatusContrato | null | undefined): string {
    if (!estatus) return '—';
    const map: Record<EstatusContrato, string> = {
      VIGENTE: 'Vigente',
      VENCIDO: 'Vencido',
      FINIQUITADO: 'Finiquitado',
      EN_VENTA: 'En venta',
      VENDIDO: 'Vendido',
      CANCELADO: 'Cancelado'
    };
    return map[estatus] ?? estatus;
  }

  moneda(v: number | null | undefined): string {
    if (v == null) return '—';
    return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
