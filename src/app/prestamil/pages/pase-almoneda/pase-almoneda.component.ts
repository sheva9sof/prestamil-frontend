import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PdfVisorComponent } from '../../core/components/pdf-visor/pdf-visor.component';
import {
  CarteraVencidaRow,
  PaseAlmonedaService,
  PaseAVentaRow,
  ResultadosPaseAlmoneda
} from '../../core/services/pase-almoneda.service';

/**
 * Pantalla "Resultados del pase de almoneda" (C-11). Selector de fecha + dos pestañas (Cartera
 * vencida / Pase a venta) con exportacion a PDF (reporte Jasper en visor modal) y a Excel (CSV UTF-8 BOM).
 */
@Component({
  selector: 'app-pase-almoneda',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  providers: [DatePipe, DecimalPipe],
  templateUrl: './pase-almoneda.component.html'
})
export class PaseAlmonedaComponent implements OnInit {
  fecha = this.hoyIso();
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
      next: (blob) => this.descargarBlob(blob, filename),
      error: (err) => {
        console.error('[PaseAlmoneda] exportar', err);
        this.errorMessage = 'No se pudo exportar el archivo.';
      }
    });
  }

  private descargarBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private hoyIso(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
