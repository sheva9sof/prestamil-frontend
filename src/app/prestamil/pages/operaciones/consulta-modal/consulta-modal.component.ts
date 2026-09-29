import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbActiveModal, NgbModal, NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';
import { MovimientoService } from 'src/app/prestamil/core/services/movimiento.service';
import { TicketVisorComponent } from 'src/app/prestamil/core/components/ticket-visor/ticket-visor.component';
import {
  ContratoOperacionDetalleResponse,
  MovimientoResponse,
  PartidaContratoResponse,
  TipoMovimiento
} from 'src/app/prestamil/core/models/contrato.model';

/** Códigos y colores del catálogo de movimientos (sección 6 del plan de Finiquitos y Refrendos). */
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

const ETIQUETA_ESTATUS_PARTIDA: Record<PartidaContratoResponse['estatus'], string> = {
  OP: 'En operación',
  FIN: 'Finiquitada',
  VEN: 'Vendida',
  APA: 'Apartada'
};

/**
 * Consulta de partidas y movimientos (F8, RN-22/23). Modal fullscreen con dos tablas apiladas para que
 * respiren en monitores chicos: historial completo (incluye cancelados, tachados con motivo) y partidas
 * del contrato. Solo lectura: no modifica nada. "Cancelar último movimiento" se activa en F10.
 */
@Component({
  selector: 'app-consulta-modal',
  standalone: true,
  imports: [CommonModule, NgbTooltipModule],
  templateUrl: './consulta-modal.component.html',
  styleUrls: ['./consulta-modal.component.scss']
})
export class ConsultaModalComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private movimientoService = inject(MovimientoService);
  private modalService = inject(NgbModal);

  @Input() contrato!: ContratoOperacionDetalleResponse;

  movimientos: MovimientoResponse[] = [];
  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.movimientoService.getMovimientos(this.contrato.id).subscribe({
      next: (movs) => {
        this.movimientos = movs;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo cargar el historial del contrato.';
      }
    });
  }

  /** El último movimiento vigente ≠ EMP: lo que reimprime el ticket (RN-22). */
  get ultimoMovimientoVigente(): MovimientoResponse | null {
    for (let i = this.movimientos.length - 1; i >= 0; i--) {
      const m = this.movimientos[i];
      if (!m.cancelado && m.tipo !== 'EMP') return m;
    }
    return null;
  }

  get hayMovimientoVigente(): boolean {
    return this.ultimoMovimientoVigente !== null;
  }

  reimprimirTicket(): void {
    const ref = this.modalService.open(TicketVisorComponent, { centered: true, scrollable: true });
    const visor = ref.componentInstance as TicketVisorComponent;
    visor.contratoIdVigente = this.contrato.id;
    visor.titulo = `Ticket vigente · Contrato ${this.contrato.folio}`;
  }

  colorTipo(tipo: TipoMovimiento): string {
    return COLOR_MOVIMIENTO[tipo] ?? '#212529';
  }

  etiquetaTipo(tipo: TipoMovimiento): string {
    return NOMBRE_MOVIMIENTO[tipo] ?? tipo;
  }

  etiquetaEstatusPartida(estatus: PartidaContratoResponse['estatus']): string {
    return ETIQUETA_ESTATUS_PARTIDA[estatus] ?? estatus;
  }

  /** Texto del tooltip de una fila cancelada: motivo + quién y cuándo. */
  tooltipCancelacion(m: MovimientoResponse): string {
    if (!m.cancelado) return '';
    const partes: string[] = [];
    if (m.motivoCancelacion) partes.push('Motivo: ' + m.motivoCancelacion);
    if (m.usuarioCancela) partes.push('Canceló: ' + m.usuarioCancela);
    if (m.fechaCancelacion) partes.push('Fecha: ' + new Date(m.fechaCancelacion).toLocaleString('es-MX'));
    return partes.join(' · ');
  }

  kilatajeHechura(partida: PartidaContratoResponse): string {
    const partes = [partida.kilataje ? partida.kilataje + 'K' : '', partida.hechura ?? ''].filter((p) => p);
    return partes.length ? partes.join(' / ') : '—';
  }

  /** Peso desplegado: neto (el que valuó); si hay total distinto, se muestra entre paréntesis. */
  peso(partida: PartidaContratoResponse): string {
    if (partida.pesoNeto == null) return '—';
    const neto = partida.pesoNeto.toFixed(2) + ' g';
    if (partida.pesoTotal != null && partida.pesoTotal !== partida.pesoNeto) {
      return neto + ' (' + partida.pesoTotal.toFixed(2) + ' g)';
    }
    return neto;
  }

  /** Forma de pago en una línea corta ("Efectivo $50.00 + Débito ****1234 $45.92"). */
  formaPago(m: MovimientoResponse): string {
    const partes: string[] = [];
    if (m.importeEfectivo && m.importeEfectivo > 0) {
      partes.push('Efectivo ' + this.moneda(m.importeEfectivo));
    }
    if (m.importeTarjeta && m.importeTarjeta > 0) {
      const nombre = m.tipoTarjeta === 'CREDITO' ? 'Crédito' : 'Débito';
      const ult = m.tarjetaUltimos4 ? ' ****' + m.tarjetaUltimos4 : '';
      partes.push(nombre + ult + ' ' + this.moneda(m.importeTarjeta));
    }
    return partes.length ? partes.join(' + ') : '—';
  }

  moneda(v: number | null | undefined): string {
    if (v == null) return '—';
    return '$' + v.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  periodos(m: MovimientoResponse): string {
    const n = m.periodosNormales ?? 0;
    const e = m.semanasVencidas ?? 0;
    if (m.tipo === 'EMP') return '—';
    return n + ' N / ' + e + ' E';
  }

  trackMov(_: number, m: MovimientoResponse): number {
    return m.id;
  }

  trackPartida(_: number, p: PartidaContratoResponse): number {
    return p.id;
  }
}
