import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PdfVisorComponent } from '../../core/components/pdf-visor/pdf-visor.component';
import { ReporteFiltrosComponent } from '../../core/components/reporte-filtros/reporte-filtros.component';
import { descargarArchivo, hoyIso } from '../../core/helpers/reporte.helper';
import { ReporteFiltro } from '../../core/models/reporte.model';
import {
  CarteraVencidaRow,
  PaseAlmonedaService,
  PaseAVentaRow,
  ResultadosPaseAlmoneda
} from '../../core/services/pase-almoneda.service';

/**
 * Pantalla "Resultados del pase de almoneda" (C-11). Selector de fecha + dos pestañas (Cartera
 * vencida / Pase a venta) con exportacion a PDF (reporte Jasper en visor modal) y a Excel (CSV UTF-8 BOM).
 * OTR-01: solo Sistemas cambia la fecha; para el resto el campo queda en solo lectura con la fecha
 * de hoy del servidor (el backend la impone aunque se mande otra).
 * La barra de fecha y exportación es el `reporte-filtros` común de los reportes (REP-00), con una sola fecha
 * y sin ramo.
 */
@Component({
  selector: 'app-pase-almoneda',
  standalone: true,
  imports: [CommonModule, SharedModule, ReporteFiltrosComponent],
  providers: [DatePipe, DecimalPipe],
  templateUrl: './pase-almoneda.component.html'
})
export class PaseAlmonedaComponent implements OnInit {
  /** Una sola fecha: `desde` = `hasta` = fecha del pase. */
  filtro: ReporteFiltro = { ramo: null, desde: hoyIso(), hasta: hoyIso() };
  // Hasta que el servidor responda, nadie elige fecha; la respuesta dice si este usuario puede.
  puedeElegirFecha = false;
  activeTab = 1;
  cargando = false;
  errorMessage = '';
  carteraVencida: CarteraVencidaRow[] = [];
  paseAVenta: PaseAVentaRow[] = [];
  fechaConsultada: string | null = null;

  private service = inject(PaseAlmonedaService);
  private modalService = inject(NgbModal);

  ngOnInit(): void {
    this.consultar();
  }

  get fecha(): string {
    return this.filtro.desde;
  }

  cambiarFecha(filtro: ReporteFiltro): void {
    this.filtro = filtro;
    this.consultar();
  }

  consultar(): void {
    if (!this.fecha) {
      return;
    }
    this.cargando = true;
    this.errorMessage = '';
    this.service.resultados(this.fecha).subscribe({
      next: (res: ResultadosPaseAlmoneda) => {
        this.carteraVencida = res.carteraVencida ?? [];
        this.paseAVenta = res.paseAVenta ?? [];
        this.fechaConsultada = res.fecha;
        this.puedeElegirFecha = res.puedeElegirFecha;
        // Para quien no elige fecha, el campo muestra la fecha que usó el servidor (su "hoy").
        if (!res.puedeElegirFecha) {
          this.filtro = { ramo: null, desde: res.fecha, hasta: res.fecha };
        }
        this.cargando = false;
      },
      error: (err) => {
        console.error('[PaseAlmoneda] error', err);
        this.errorMessage = 'No se pudo cargar el pase de almoneda.';
        this.carteraVencida = [];
        this.paseAVenta = [];
        this.cargando = false;
      }
    });
  }

  /** Abre en un visor modal el reporte PDF de la pestaña activa (descargar o imprimir desde ahí). */
  exportarPdf(): void {
    if (!this.fecha) {
      return;
    }
    const esCartera = this.activeTab === 1;
    const ref = this.modalService.open(PdfVisorComponent, { size: 'xl', scrollable: true });
    const visor = ref.componentInstance as PdfVisorComponent;
    visor.pdf$ = esCartera ? this.service.pdfCarteraVencida(this.fecha) : this.service.pdfPaseAVenta(this.fecha);
    visor.titulo = (esCartera ? 'Cartera vencida' : 'Pase a venta') + ' · ' + this.fecha;
    visor.nombreArchivo = (esCartera ? 'cartera-vencida-' : 'pase-a-venta-') + this.fecha + '.pdf';
  }

  exportarExcel(): void {
    if (!this.fecha) {
      return;
    }
    const esCartera = this.activeTab === 1;
    const peticion$ = esCartera
      ? this.service.descargarCarteraVencida(this.fecha)
      : this.service.descargarPaseAVenta(this.fecha);
    const filename = (esCartera ? 'cartera-vencida-' : 'pase-a-venta-') + this.fecha + '.csv';
    peticion$.subscribe({
      next: (blob) => descargarArchivo(blob, filename),
      error: (err) => {
        console.error('[PaseAlmoneda] exportar', err);
        this.errorMessage = 'No se pudo exportar el archivo.';
      }
    });
  }
}
