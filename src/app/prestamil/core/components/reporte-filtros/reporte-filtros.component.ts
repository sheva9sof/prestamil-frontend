import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReporteFiltro } from '../../models/reporte.model';
import { PrendaService, TipoPrendaResponse } from '../../services/prenda.service';

/**
 * Barra de filtros común de los reportes (REP-00): ramo (Todos + tipos de prenda, Q-05), rango de fechas
 * y los botones Pantalla (PDF en el visor) y Exportar (Excel). Solo arma el filtro y avisa qué botón se
 * oprimió; la página llama a su servicio y abre el visor o descarga el archivo.
 *
 * Se adapta a cada reporte: sin ramo (`conRamo=false`), con una sola fecha (`conRango=false`, entonces
 * `desde` = `hasta`), con la fecha fija para quien no puede elegir otra (`fechaEditable=false`, OTR-01) y
 * con un botón "Consultar" si la página además muestra los datos en una tabla (`textoConsultar`).
 */
@Component({
  selector: 'app-reporte-filtros',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporte-filtros.component.html'
})
export class ReporteFiltrosComponent implements OnInit {
  private static siguienteId = 0;

  private prendaService = inject(PrendaService);

  /** Prefijo de los id de los campos, único por instancia para que los label apunten bien. */
  readonly id = `reporte-filtros-${ReporteFiltrosComponent.siguienteId++}`;

  @Input({ required: true }) filtro!: ReporteFiltro;
  @Output() filtroChange = new EventEmitter<ReporteFiltro>();

  @Input() conRamo = true;
  @Input() conRango = true;
  /** false: la fecha se muestra en solo lectura (el servidor impone la de hoy). */
  @Input() fechaEditable = true;
  @Input() avisoFechaFija = 'Solo se puede consultar el día de hoy.';
  /** Último día seleccionable (yyyy-MM-dd), normalmente hoy del servidor. */
  @Input() fechaMaxima: string | null = null;
  @Input() cargando = false;

  /** Si se indica, aparece el botón principal que consulta los datos para la tabla de la página. */
  @Input() textoConsultar: string | null = null;
  @Input() textoPantalla = 'Pantalla';
  @Input() textoExportar = 'Exportar a Excel';

  @Output() consultar = new EventEmitter<ReporteFiltro>();
  @Output() pantalla = new EventEmitter<ReporteFiltro>();
  @Output() exportar = new EventEmitter<ReporteFiltro>();

  ramos: TipoPrendaResponse[] = [];

  ngOnInit(): void {
    if (this.conRamo) {
      this.prendaService.getTipos().subscribe({
        next: (tipos) => (this.ramos = tipos),
        // Sin catálogo el combo queda solo con "Todos"; el reporte se puede sacar igual
        error: (err) => console.error('[ReporteFiltros] ramos', err)
      });
    }
  }

  /** El rango está completo y en orden; si no, los botones se deshabilitan. */
  get filtroValido(): boolean {
    return !!this.filtro.desde && !!this.filtro.hasta && this.filtro.desde <= this.filtro.hasta;
  }

  get rangoInvertido(): boolean {
    return !!this.filtro.desde && !!this.filtro.hasta && this.filtro.desde > this.filtro.hasta;
  }

  cambiarRamo(ramo: number | null): void {
    this.emitirCambio({ ...this.filtro, ramo });
  }

  cambiarDesde(desde: string): void {
    // Con una sola fecha, el rango es ese día
    this.emitirCambio({ ...this.filtro, desde, hasta: this.conRango ? this.filtro.hasta : desde });
  }

  cambiarHasta(hasta: string): void {
    this.emitirCambio({ ...this.filtro, hasta });
  }

  onConsultar(): void {
    if (this.filtroValido) this.consultar.emit(this.filtro);
  }

  onPantalla(): void {
    if (this.filtroValido) this.pantalla.emit(this.filtro);
  }

  onExportar(): void {
    if (this.filtroValido) this.exportar.emit(this.filtro);
  }

  private emitirCambio(filtro: ReporteFiltro): void {
    this.filtro = filtro;
    this.filtroChange.emit(filtro);
  }
}
