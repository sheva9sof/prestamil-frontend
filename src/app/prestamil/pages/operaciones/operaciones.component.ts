import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ContratoService } from 'src/app/prestamil/core/services/contrato.service';
import { PrendaService, TipoPrendaResponse } from 'src/app/prestamil/core/services/prenda.service';
import {
  AccionContrato,
  BuscarContratoPor,
  ContratoOperacionDetalleResponse,
  ContratoOperacionResponse,
  EstatusOperativo,
  FiltroEstatusOperacion,
  MovimientoResponse,
  PartidaContratoResponse,
  TipoMovimiento
} from 'src/app/prestamil/core/models/contrato.model';
import { PageResponse } from 'src/app/prestamil/core/models/page.model';
import { TicketVisorComponent } from 'src/app/prestamil/core/components/ticket-visor/ticket-visor.component';
import { RefrendoModalComponent } from './refrendo-modal/refrendo-modal.component';
import { FiniquitoModalComponent } from './finiquito-modal/finiquito-modal.component';
import { AbonoModalComponent } from './abono-modal/abono-modal.component';
import { RefrendoParcialModalComponent } from './refrendo-parcial-modal/refrendo-parcial-modal.component';
import { ConsultaModalComponent } from './consulta-modal/consulta-modal.component';
import { ReposicionModalComponent } from './reposicion-modal/reposicion-modal.component';
import { CancelacionModalComponent } from './cancelacion-modal/cancelacion-modal.component';

interface BotonAccion {
  accion: AccionContrato;
  etiqueta: string;
  icono: string;
  /** Fase del plan de Finiquitos y Refrendos que implementa el botón. */
  fase: string;
}

const ETIQUETA_ESTATUS: Record<EstatusOperativo, string> = {
  VIGENTE: 'Vigente',
  EN_GRACIA: 'Periodo de gracia',
  VENCIDO: 'Vencido',
  EN_VENTA: 'En venta',
  APARTADO: 'Apartado',
  VENDIDO: 'Vendido',
  FINIQUITADO: 'Finiquitado',
  CANCELADO: 'Cancelado'
};

const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = {
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

@Component({
  selector: 'app-operaciones',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './operaciones.component.html',
  styleUrls: ['./operaciones.component.scss']
})
export class OperacionesComponent implements OnInit {
  private contratoService = inject(ContratoService);
  private prendaService = inject(PrendaService);
  private modalService = inject(NgbModal);

  @ViewChild('detalleModal') detalleModalTemplate!: TemplateRef<unknown>;
  @ViewChild('accionModal') accionModalTemplate!: TemplateRef<unknown>;

  readonly opcionesBuscarPor: { valor: BuscarContratoPor; etiqueta: string; placeholder: string }[] = [
    { valor: 'CONTRATO', etiqueta: 'Contrato', placeholder: 'Número o folio de contrato' },
    { valor: 'NUM_CLIENTE', etiqueta: 'Núm. de cliente', placeholder: 'Número de cliente' },
    { valor: 'NOMBRE_CLIENTE', etiqueta: 'Nombre del cliente', placeholder: 'Nombre y/o apellidos' },
    { valor: 'FECHA_CONTRATO', etiqueta: 'Fecha de contrato', placeholder: '' }
  ];

  readonly opcionesEstatus: { valor: FiltroEstatusOperacion; etiqueta: string }[] = [
    { valor: 'TODOS', etiqueta: 'Todos' },
    { valor: 'EN_OPERACION', etiqueta: 'En operación' },
    { valor: 'REFRENDADOS', etiqueta: 'Refrendados' },
    { valor: 'PERIODO_GRACIA', etiqueta: 'Periodo de gracia' },
    { valor: 'VENCIDOS', etiqueta: 'Vencidos' },
    { valor: 'EN_VENTA', etiqueta: 'En venta' },
    { valor: 'VENDIDOS', etiqueta: 'Vendidos' },
    { valor: 'FINIQUITADOS', etiqueta: 'Finiquitados' },
    { valor: 'CANCELADOS', etiqueta: 'Cancelados' }
  ];

  readonly botonesAccion: BotonAccion[] = [
    { accion: 'REFRENDO', etiqueta: 'Refrendar', icono: 'icon-refresh-cw', fase: 'F3' },
    { accion: 'FINIQUITO', etiqueta: 'Finiquitar', icono: 'icon-check-square', fase: 'F4' },
    { accion: 'ABONO_CAPITAL', etiqueta: 'Abono a capital', icono: 'icon-trending-down', fase: 'F5' },
    { accion: 'REFRENDO_PARCIAL', etiqueta: 'Refrendo parcial', icono: 'icon-pie-chart', fase: 'F7' },
    { accion: 'REFRENDO_EXTEMPORANEO', etiqueta: 'Refrendo extemporáneo', icono: 'icon-rotate-ccw', fase: 'F6' },
    { accion: 'FINIQUITO_EXTEMPORANEO', etiqueta: 'Finiquito extemporáneo', icono: 'icon-alert-octagon', fase: 'F6' },
    { accion: 'REPOSICION', etiqueta: 'Reimpresión de contrato', icono: 'icon-printer', fase: 'F9' },
    { accion: 'CONSULTA', etiqueta: 'Consulta de movimientos', icono: 'icon-list', fase: 'F8' },
    { accion: 'CANCELACION', etiqueta: 'Cancelación', icono: 'icon-x-circle', fase: 'F10' }
  ];

  ramos: TipoPrendaResponse[] = [];

  filtroTexto = '';
  filtroBuscarPor: BuscarContratoPor = 'CONTRATO';
  filtroRamo: number | null = null;
  filtroEstatus: FiltroEstatusOperacion = 'TODOS';

  pagina: PageResponse<ContratoOperacionResponse> | null = null;
  /** Página visible, desde 1 (el backend cuenta desde 0). */
  paginaActual = 1;
  itemsPorPagina = 20;
  isLoading = false;
  errorMessage = '';

  detalle: ContratoOperacionDetalleResponse | null = null;
  isLoadingDetalle = false;
  detalleError = '';
  detalleModalRef: NgbModalRef | null = null;
  accionSeleccionada: BotonAccion | null = null;

  get placeholderBusqueda(): string {
    return this.opcionesBuscarPor.find((o) => o.valor === this.filtroBuscarPor)?.placeholder ?? '';
  }

  get totalPaginas(): number {
    return this.pagina?.totalPages ?? 0;
  }

  ngOnInit(): void {
    this.prendaService.getTipos().subscribe({
      next: (tipos) => (this.ramos = tipos),
      error: () => (this.ramos = [])
    });
    this.buscar();
  }

  buscar(): void {
    this.paginaActual = 1;
    this.cargarPagina();
  }

  cargarPagina(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.contratoService
      .buscarOperacion({
        q: this.filtroTexto,
        buscarPor: this.filtroBuscarPor,
        ramo: this.filtroRamo,
        estatus: this.filtroEstatus,
        page: this.paginaActual - 1,
        size: this.itemsPorPagina
      })
      .subscribe({
        next: (pagina) => {
          this.pagina = pagina;
          this.isLoading = false;
        },
        error: (err) => {
          this.pagina = null;
          this.isLoading = false;
          this.errorMessage = err?.error?.message ?? 'Error al consultar los contratos.';
        }
      });
  }

  /** Los radios de estatus y el ramo filtran de inmediato, como en COCAE. */
  cambiarEstatus(estatus: FiltroEstatusOperacion): void {
    this.filtroEstatus = estatus;
    this.buscar();
  }

  cambiarBuscarPor(): void {
    // El campo cambia de texto a fecha: lo capturado ya no aplica
    this.filtroTexto = '';
  }

  limpiarFiltros(): void {
    this.filtroTexto = '';
    this.filtroBuscarPor = 'CONTRATO';
    this.filtroRamo = null;
    this.filtroEstatus = 'TODOS';
    this.buscar();
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas && pagina !== this.paginaActual) {
      this.paginaActual = pagina;
      this.cargarPagina();
    }
  }

  getPaginas(): number[] {
    const paginas: number[] = [];
    const max = 5;
    if (this.totalPaginas <= max) {
      for (let i = 1; i <= this.totalPaginas; i++) paginas.push(i);
    } else {
      let inicio = Math.max(1, this.paginaActual - 2);
      const fin = Math.min(this.totalPaginas, inicio + max - 1);
      if (fin - inicio < max - 1) inicio = Math.max(1, fin - max + 1);
      for (let i = inicio; i <= fin; i++) paginas.push(i);
    }
    return paginas;
  }

  abrirDetalle(fila: ContratoOperacionResponse): void {
    this.detalle = null;
    this.detalleError = '';
    this.isLoadingDetalle = true;
    this.detalleModalRef = this.modalService.open(this.detalleModalTemplate, {
      centered: true,
      size: 'xl',
      windowClass: 'operacion-modal'
    });
    this.contratoService.getOperacion(fila.id).subscribe({
      next: (detalle) => {
        this.detalle = detalle;
        this.isLoadingDetalle = false;
      },
      error: (err) => {
        this.isLoadingDetalle = false;
        this.detalleError = err?.error?.message ?? 'Error al cargar el contrato.';
      }
    });
  }

  cerrarDetalle(): void {
    this.detalleModalRef?.close();
    this.detalleModalRef = null;
  }

  /** El backend decide qué acciones aplican (matriz RN-16); el frontend solo las refleja. */
  puede(accion: AccionContrato): boolean {
    return this.detalle?.accionesDisponibles.includes(accion) ?? false;
  }

  abrirAccion(boton: BotonAccion): void {
    if (!this.puede(boton.accion)) return;
    // El backend resuelve RF/RPG/RX y FI/FX por fecha (F1): un mismo modal cubre las dos variantes.
    if (boton.accion === 'REFRENDO' || boton.accion === 'REFRENDO_EXTEMPORANEO') {
      this.abrirRefrendo();
      return;
    }
    if (boton.accion === 'FINIQUITO' || boton.accion === 'FINIQUITO_EXTEMPORANEO') {
      this.abrirFiniquito();
      return;
    }
    if (boton.accion === 'ABONO_CAPITAL') {
      this.abrirAbono();
      return;
    }
    if (boton.accion === 'REFRENDO_PARCIAL') {
      this.abrirRefrendoParcial();
      return;
    }
    if (boton.accion === 'CONSULTA') {
      this.abrirConsulta();
      return;
    }
    if (boton.accion === 'CANCELACION') {
      this.abrirCancelacion();
      return;
    }
    if (boton.accion === 'REPOSICION') {
      this.abrirReposicion();
      return;
    }
    this.accionSeleccionada = boton;
    this.modalService.open(this.accionModalTemplate, { centered: true });
  }

  private abrirReposicion(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(ReposicionModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'operacion-modal'
    });
    (ref.componentInstance as ReposicionModalComponent).contrato = detalle;
    ref.result.then(
      (movimiento: MovimientoResponse) => this.movimientoRegistrado(detalle.id, movimiento),
      () => undefined
    );
  }

  private abrirConsulta(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(ConsultaModalComponent, {
      fullscreen: true,
      scrollable: true,
      backdrop: 'static',
      windowClass: 'consulta-modal-window'
    });
    (ref.componentInstance as ConsultaModalComponent).contrato = detalle;
    // La cancelación vive en su propio modal (F10, RN-26). La Consulta es solo lectura.
  }

  private abrirCancelacion(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(CancelacionModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'operacion-modal'
    });
    (ref.componentInstance as CancelacionModalComponent).contrato = detalle;
    ref.result.then(
      () => {
        // El backend restauró el contrato al estado previo; refrescar detalle y listado
        this.recargarDetalle(detalle.id);
        this.cargarPagina();
      },
      () => undefined
    );
  }

  private abrirRefrendo(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(RefrendoModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'operacion-modal'
    });
    (ref.componentInstance as RefrendoModalComponent).contrato = detalle;
    ref.result.then(
      (movimiento: MovimientoResponse) => this.movimientoRegistrado(detalle.id, movimiento),
      () => undefined
    );
  }

  private abrirFiniquito(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(FiniquitoModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'operacion-modal'
    });
    (ref.componentInstance as FiniquitoModalComponent).contrato = detalle;
    ref.result.then(
      (movimiento: MovimientoResponse) => this.movimientoRegistrado(detalle.id, movimiento),
      () => undefined
    );
  }

  private abrirAbono(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(AbonoModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'operacion-modal'
    });
    (ref.componentInstance as AbonoModalComponent).contrato = detalle;
    ref.result.then(
      (movimiento: MovimientoResponse) => this.movimientoRegistrado(detalle.id, movimiento),
      () => undefined
    );
  }

  private abrirRefrendoParcial(): void {
    const detalle = this.detalle;
    if (!detalle) return;
    const ref = this.modalService.open(RefrendoParcialModalComponent, {
      centered: true,
      size: 'lg',
      backdrop: 'static',
      windowClass: 'operacion-modal'
    });
    (ref.componentInstance as RefrendoParcialModalComponent).contrato = detalle;
    ref.result.then(
      (movimiento: MovimientoResponse) => this.movimientoRegistrado(detalle.id, movimiento),
      () => undefined
    );
  }

  /** Tras cobrar: ticket para imprimir y el contrato y el listado con sus nuevas fechas. */
  private movimientoRegistrado(contratoId: number, movimiento: MovimientoResponse): void {
    const ticket = this.modalService.open(TicketVisorComponent, { centered: true, scrollable: true });
    const visor = ticket.componentInstance as TicketVisorComponent;
    visor.movimientoId = movimiento.id;
    visor.titulo = `Nota ${movimiento.folioNota ?? ''} · Contrato ${movimiento.folioContrato}`;
    const monto = movimiento.monto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    visor.mensaje = `${this.etiquetaMovimiento(movimiento.tipo)} registrado por $${monto}.`;

    this.recargarDetalle(contratoId);
    this.cargarPagina();
  }

  private recargarDetalle(contratoId: number): void {
    this.contratoService.getOperacion(contratoId).subscribe({
      next: (detalle) => (this.detalle = detalle),
      error: (err) => (this.detalleError = err?.error?.message ?? 'Error al actualizar el contrato.')
    });
  }

  etiquetaEstatus(estatus: EstatusOperativo): string {
    return ETIQUETA_ESTATUS[estatus] ?? estatus;
  }

  claseEstatus(estatus: EstatusOperativo): string {
    return 'estatus-' + estatus.toLowerCase().replace('_', '-');
  }

  etiquetaMovimiento(tipo: TipoMovimiento): string {
    return ETIQUETA_MOVIMIENTO[tipo] ?? tipo;
  }

  /** Plazo como lo muestra COCAE: "04 SEM". */
  plazoCorto(fila: ContratoOperacionResponse): string {
    const unidad: Record<number, string> = { 7: 'SEM', 14: 'CAT', 15: 'QNA', 30: 'MES' };
    const periodos = String(fila.numeroPeriodos).padStart(2, '0');
    return `${periodos} ${unidad[fila.diasPorPeriodo] ?? fila.diasPorPeriodo + 'D'}`;
  }

  kilatajeHechura(partida: PartidaContratoResponse): string {
    const partes = [partida.kilataje ? `${partida.kilataje}K` : '', partida.hechura ?? ''].filter((p) => p);
    return partes.length ? partes.join(' / ') : '—';
  }

  trackById(_: number, fila: ContratoOperacionResponse): number {
    return fila.id;
  }
}
