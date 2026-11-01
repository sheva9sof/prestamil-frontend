import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PdfVisorComponent } from '../../../core/components/pdf-visor/pdf-visor.component';
import { ReporteFiltrosComponent } from '../../../core/components/reporte-filtros/reporte-filtros.component';
import { descargarArchivo } from '../../../core/helpers/reporte.helper';
import { ReporteFiltro } from '../../../core/models/reporte.model';
import { AuthService } from '../../../core/services/auth.service';
import { CajaService } from '../../../core/services/caja.service';
import { NavigationItem } from '../../../../theme/layout/admin/navigation/navigation';

const URL_PANTALLA = '/caja/corte-mensual';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

/**
 * Reporte mensual de corte de caja (REP-06): un selector de mes y año (el `reporte-filtros` común en modo
 * mes) con "Ver PDF" en el visor y "Exportar Excel". Un renglón por día con el bloque inferior del corte y una
 * fila de totales; las cifras salen del mismo motor que el corte diario (RC-09), con los días cerrados
 * congelados y los pendientes marcados.
 *
 * Solo gerente y Sistemas: el servidor responde 403 al cajero. Si la opción no está en el menú del usuario (el
 * cajero que escribe la URL a mano), la pantalla avisa sin llamar al servidor: el interceptor global trata
 * cualquier 403 como sesión revocada y lo sacaría del sistema.
 * Los meses llegan hasta el de hoy del servidor y los años empiezan en el del arranque de caja.
 */
@Component({
  selector: 'app-corte-mensual',
  standalone: true,
  imports: [CommonModule, SharedModule, ReporteFiltrosComponent],
  templateUrl: './corte-mensual.component.html'
})
export class CorteMensualComponent implements OnInit {
  private cajaService = inject(CajaService);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);

  /** El mes como rango: `desde` = día 1 y `hasta` = último día. */
  filtro: ReporteFiltro | null = null;
  hoy: string | null = null;
  fechaArranque: string | null = null;

  isLoading = false;
  isExportando = false;
  sinPermiso = false;
  errorMessage = '';

  ngOnInit(): void {
    if (!tieneOpcion(this.authService.getMenuItems(), URL_PANTALLA)) {
      this.sinPermiso = true;
      return;
    }
    this.isLoading = true;
    this.cajaService.corteMensualContexto().subscribe({
      next: (ctx) => {
        this.hoy = ctx.hoy;
        this.fechaArranque = ctx.fechaArranque;
        // Por defecto, el mes en curso del servidor
        this.filtro = { ramo: null, ...rangoDelMes(ctx.hoy) };
        this.isLoading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.isLoading = false;
        if (err.status === 403) {
          this.sinPermiso = true;
        } else {
          this.errorMessage = err.error?.message ?? 'No se pudo cargar la pantalla del corte mensual.';
        }
      }
    });
  }

  /** Abre el mensual en el visor para imprimirlo o descargarlo. */
  verPdf(filtro: ReporteFiltro): void {
    this.errorMessage = '';
    const ref = this.modalService.open(PdfVisorComponent, { size: 'xl', scrollable: true });
    const visor = ref.componentInstance as PdfVisorComponent;
    visor.pdf$ = this.cajaService.corteMensualPdf(filtro);
    visor.titulo = `Corte de caja mensual · ${this.nombreMes(filtro.desde)}`;
    visor.nombreArchivo = `corte-caja-mensual-${filtro.desde.substring(0, 7)}.pdf`;
  }

  exportarExcel(filtro: ReporteFiltro): void {
    if (this.isExportando) return;
    this.isExportando = true;
    this.errorMessage = '';
    this.cajaService.corteMensualExcel(filtro).subscribe({
      next: (blob) => {
        this.isExportando = false;
        descargarArchivo(blob, `corte-caja-mensual-${filtro.desde.substring(0, 7)}.xlsx`);
      },
      error: (err) => {
        this.isExportando = false;
        this.errorMessage = 'No se pudo exportar el corte mensual a Excel.';
        // Con responseType 'blob' el cuerpo del error también llega como Blob
        const cuerpo = err?.error;
        if (cuerpo instanceof Blob) {
          cuerpo.text().then((texto) => {
            try {
              const message = JSON.parse(texto)?.message;
              if (message) this.errorMessage = `No se pudo exportar el corte mensual a Excel: ${message}`;
            } catch {
              // Cuerpo no JSON: se queda el mensaje genérico
            }
          });
        }
      }
    });
  }

  /** "octubre de 2026" para un yyyy-MM-dd. */
  nombreMes(fecha: string): string {
    return `${MESES[Number(fecha.substring(5, 7)) - 1]} de ${fecha.substring(0, 4)}`;
  }

  /** dd/MM/yyyy para un yyyy-MM-dd. */
  fechaCorta(fecha: string): string {
    return `${fecha.substring(8, 10)}/${fecha.substring(5, 7)}/${fecha.substring(0, 4)}`;
  }

  /** El mes elegido es el de hoy: el reporte llega hasta hoy. */
  get esMesEnCurso(): boolean {
    return !!this.filtro && !!this.hoy && this.filtro.desde.substring(0, 7) === this.hoy.substring(0, 7);
  }

  /** El mes elegido es anterior al del arranque: el reporte saldrá sin cifras. */
  get antesDelArranque(): boolean {
    return !!this.filtro && !!this.fechaArranque && this.filtro.desde.substring(0, 7) < this.fechaArranque.substring(0, 7);
  }
}

/** Primer y último día del mes de una fecha yyyy-MM-dd. */
function rangoDelMes(fecha: string): { desde: string; hasta: string } {
  const anio = Number(fecha.substring(0, 4));
  const mes = Number(fecha.substring(5, 7));
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const prefijo = fecha.substring(0, 7);
  return { desde: `${prefijo}-01`, hasta: `${prefijo}-${String(ultimoDia).padStart(2, '0')}` };
}

/** La opción del menú con esa URL está entre las del usuario (o en sus submenús). */
function tieneOpcion(items: NavigationItem[], url: string): boolean {
  return items.some((item) => item.url === url || tieneOpcion(item.children ?? [], url));
}
