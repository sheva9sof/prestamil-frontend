import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DenominacionesModalComponent } from '../../../core/components/denominaciones-modal/denominaciones-modal.component';
import { PdfVisorComponent } from '../../../core/components/pdf-visor/pdf-visor.component';
import { descargarArchivo } from '../../../core/helpers/reporte.helper';
import { CierreCaja, CorteCaja, CorteCajaRenglon, DesgloseCapturado } from '../../../core/models/caja.model';
import { CajaService } from '../../../core/services/caja.service';

/** Las diferencias de ±0.01–0.03 son normales por redondeo (RC-07). */
const TOLERANCIA_REDONDEO_CENTAVOS = 3;

/** Un PDF que se abre en el visor. */
interface ReporteVisor {
  titulo: string;
  pdf$: Observable<Blob>;
  nombreArchivo: string;
}

/**
 * Pantalla del corte de caja (CAJ-07a) con el cierre de día (CAJ-06). Muestra los dos bloques de
 * `CorteCajaService` en el orden del PDF de COCAE: arriba los movimientos de ventanilla (solo efectivo),
 * aparte lo cobrado con tarjeta (RC-06) y abajo la bóveda y el arqueo (RC-07, RC-08).
 *
 * El cajero solo ve el corte de hoy (como OTR-01). Si el día es anterior al arranque o no hay saldo de
 * arranque, el servidor manda un aviso y la pantalla lo muestra sin cifras. El arqueo opcional cuenta la
 * gaveta con `denominaciones-modal` y la compara contra lo que dice el sistema; no se guarda.
 *
 * "Imprimir corte" y "Exportar Excel" sacan el reporte REP-04 del día que está en pantalla, con las mismas
 * cifras (las calcula el servidor con el mismo motor). Sin cifras, el PDF sale con el aviso.
 *
 * "Cerrar día" (CAJ-06, CAJ-07b, B-04) congela el corte: el gerente cierra el día en curso y Sistemas un
 * día que quedó pendiente; el cajero nunca. Quién puede cerrar lo decide el servidor (`puedeCerrar`); si
 * algo lo impide (un turno abierto, un día anterior pendiente, el arranque sin capturar), el botón queda
 * deshabilitado con el motivo. Antes de cerrar se confirma con el resumen del día y, si se hizo, el arqueo.
 * Al cerrar se abre el corte (REP-04) para imprimirlo. Un día cerrado queda en modo lectura: sin cerrar ni
 * arqueo, pero con imprimir y exportar. Si hay un día pendiente de cierre, se avisa arriba y Sistemas puede
 * ir a él con un clic.
 */
@Component({
  selector: 'app-corte',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './corte.component.html',
  styleUrls: ['./corte.component.scss']
})
export class CorteComponent implements OnInit {
  private cajaService = inject(CajaService);
  private modalService = inject(NgbModal);

  /** Fecha del selector (yyyy-MM-dd); null hasta que el servidor diga cuál es hoy. */
  fecha: string | null = null;
  hoy: string | null = null;
  // Hasta que el servidor responda, nadie elige fecha; la respuesta dice si este usuario puede.
  puedeElegirFecha = false;
  corte: CorteCaja | null = null;

  /** Conteo de la gaveta del arqueo; se descarta al cambiar de día. */
  conteo: DesgloseCapturado | null = null;

  // Cierre de día (CAJ-06), tal como lo manda el servidor
  cierre: CierreCaja | null = null;
  cerrado = false;
  diaPendiente = false;
  puedeCerrar = false;
  avisoCierre: string | null = null;
  primerDiaPendiente: string | null = null;
  puedeCerrarPendiente = false;
  @ViewChild('confirmarCierre') confirmarCierreTpl!: TemplateRef<unknown>;

  isLoading = false;
  isExportando = false;
  isCerrando = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cajaService.corte(this.fecha).subscribe({
      next: (res) => {
        if (res.fecha !== this.corte?.fecha) {
          this.conteo = null;
        }
        // Para el cajero, el campo muestra la fecha que usó el servidor (su "hoy")
        this.fecha = res.fecha;
        this.hoy = res.hoy;
        this.puedeElegirFecha = res.puedeElegirFecha;
        this.corte = res.corte;
        this.cierre = res.cierre;
        this.cerrado = res.cerrado;
        this.diaPendiente = res.diaPendiente;
        this.puedeCerrar = res.puedeCerrar;
        this.avisoCierre = res.avisoCierre;
        this.primerDiaPendiente = res.primerDiaPendiente;
        this.puedeCerrarPendiente = res.puedeCerrarPendiente;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo calcular el corte de caja.';
        // El selector vuelve al día del corte que sigue en pantalla
        this.fecha = this.corte?.fecha ?? this.fecha;
      }
    });
  }

  /** Lleva la pantalla al día pendiente de cierre (solo se ofrece a quien puede cerrarlo). */
  irAlDiaPendiente(): void {
    if (!this.primerDiaPendiente || !this.puedeElegirFecha) return;
    this.fecha = this.primerDiaPendiente;
    this.successMessage = '';
    this.cargar();
  }

  /**
   * Pide confirmación con el resumen del día y lo cierra; el corte queda congelado. Al cerrar se abren los
   * reportes del cierre para imprimirlos.
   */
  cerrarDia(): void {
    const fecha = this.corte?.fecha;
    if (!fecha || !this.puedeCerrar || this.avisoCierre || this.isCerrando) return;
    const ref = this.modalService.open(this.confirmarCierreTpl, { centered: true });
    ref.result.then(
      (resultado) => {
        if (resultado !== 'confirmar') return;
        this.isCerrando = true;
        this.errorMessage = '';
        this.successMessage = '';
        this.cajaService.cerrarDia(fecha).subscribe({
          next: (cierre) => {
            this.isCerrando = false;
            this.successMessage = `Se cerró la caja del ${this.fechaCorta(cierre.fecha)}.`;
            // El conteo era de la gaveta abierta; el día ya queda en modo lectura
            this.conteo = null;
            this.cargar();
            this.abrirReportes(this.reportesDelCierre(cierre.fecha), this.successMessage);
          },
          error: (err) => {
            this.isCerrando = false;
            this.errorMessage = err?.error?.message ?? 'No se pudo cerrar el día.';
            this.cargar();
          }
        });
      },
      () => undefined
    );
  }

  /** Abre el corte del día en pantalla (REP-04) en el visor, para imprimirlo o descargarlo. */
  imprimirCorte(): void {
    const fecha = this.corte?.fecha;
    if (!fecha) return;
    this.abrirVisor(this.reporteCorte(fecha));
  }

  /**
   * Reportes que se imprimen al cerrar el día, en el orden en que se abren. El resumen de operación diaria
   * (REP-05) se agrega aquí cuando exista su endpoint; mientras tanto solo sale el corte (REP-04).
   */
  private reportesDelCierre(fecha: string): ReporteVisor[] {
    return [this.reporteCorte(fecha)];
  }

  private reporteCorte(fecha: string): ReporteVisor {
    return {
      titulo: `Corte de caja · ${this.fechaCorta(fecha)}`,
      pdf$: this.cajaService.cortePdf(fecha),
      nombreArchivo: `corte-caja-${fecha}.pdf`
    };
  }

  /** Abre los reportes uno tras otro: el siguiente cuando se cierra el visor del anterior. */
  private abrirReportes(reportes: ReporteVisor[], mensaje = ''): void {
    const [primero, ...resto] = reportes;
    if (!primero) return;
    const siguiente = () => this.abrirReportes(resto);
    this.abrirVisor(primero, mensaje).result.then(siguiente, siguiente);
  }

  private abrirVisor(reporte: ReporteVisor, mensaje = ''): NgbModalRef {
    const ref = this.modalService.open(PdfVisorComponent, { size: 'xl', scrollable: true });
    const visor = ref.componentInstance as PdfVisorComponent;
    visor.pdf$ = reporte.pdf$;
    visor.titulo = reporte.titulo;
    visor.nombreArchivo = reporte.nombreArchivo;
    visor.mensaje = mensaje;
    return ref;
  }

  /** Descarga el corte del día en pantalla en Excel (REP-04). */
  exportarExcel(): void {
    const fecha = this.corte?.fecha;
    if (!fecha || this.isExportando) return;
    this.isExportando = true;
    this.errorMessage = '';
    this.cajaService.corteExcel(fecha).subscribe({
      next: (blob) => {
        this.isExportando = false;
        descargarArchivo(blob, `corte-caja-${fecha}.xlsx`);
      },
      error: (err) => {
        this.isExportando = false;
        this.errorMessage = 'No se pudo exportar el corte a Excel.';
        // Con responseType 'blob' el cuerpo del error también llega como Blob
        const cuerpo = err?.error;
        if (cuerpo instanceof Blob) {
          cuerpo.text().then((texto) => {
            try {
              const message = JSON.parse(texto)?.message;
              if (message) this.errorMessage = `No se pudo exportar el corte a Excel: ${message}`;
            } catch {
              // Cuerpo no JSON: se queda el mensaje genérico
            }
          });
        }
      }
    });
  }

  /** El corte trae cifras; si no, solo se muestra el aviso. */
  get conCifras(): boolean {
    return !!this.corte && !this.corte.aviso;
  }

  /** La gaveta solo se cuenta contra el corte de hoy. */
  get esHoy(): boolean {
    return !!this.corte && this.corte.fecha === this.hoy;
  }

  /** El arqueo solo se hace con la gaveta de hoy y mientras el día siga abierto. */
  get puedeArquear(): boolean {
    return this.esHoy && !this.cerrado;
  }

  /** El día en pantalla no se puede cerrar porque antes hay uno pendiente: el aviso de arriba ya lo dice. */
  get bloqueadoPorPendiente(): boolean {
    const fecha = this.corte?.fecha;
    return !!this.primerDiaPendiente && !!fecha && this.primerDiaPendiente < fecha;
  }

  get renglonesTarjeta(): CorteCajaRenglon[] {
    return this.corte?.renglones.filter((r) => r.tarjeta !== 0) ?? [];
  }

  get totalTarjeta(): number {
    const c = this.corte;
    if (!c?.ingresos || !c.egresos) return 0;
    return (Math.round(c.ingresos.tarjeta * 100) - Math.round(c.egresos.tarjeta * 100)) / 100;
  }

  /** Contado menos lo que debe haber según el sistema, en centavos: positivo sobra, negativo falta. */
  get diferenciaArqueoCentavos(): number | null {
    if (!this.conteo || this.corte?.diferencia == null) return null;
    return Math.round(this.conteo.total * 100) - Math.round(this.corte.diferencia * 100);
  }

  get diferenciaArqueo(): number | null {
    const centavos = this.diferenciaArqueoCentavos;
    return centavos == null ? null : centavos / 100;
  }

  /** Cuánto falta o sobra en la gaveta, sin signo. */
  get faltaOSobra(): number {
    return Math.abs(this.diferenciaArqueo ?? 0);
  }

  get arqueoCuadra(): boolean {
    const centavos = this.diferenciaArqueoCentavos;
    return centavos != null && Math.abs(centavos) <= TOLERANCIA_REDONDEO_CENTAVOS;
  }

  contarGaveta(): void {
    if (!this.conCifras || !this.puedeArquear) return;
    const ref = this.modalService.open(DenominacionesModalComponent, { size: 'lg', centered: true, scrollable: true });
    const modal = ref.componentInstance as DenominacionesModalComponent;
    modal.titulo = 'Arqueo de la gaveta';
    modal.subtitulo = `Corte del ${this.fechaCorta(this.corte?.fecha)} · VENTANILLA`;
    modal.desgloseInicial = this.conteo?.renglones ?? [];
    ref.result.then(
      (conteo: DesgloseCapturado) => (this.conteo = conteo),
      () => undefined
    );
  }

  descartarConteo(): void {
    this.conteo = null;
  }

  nombreIndicador(indicador: 'F' | 'S' | null): string {
    return indicador === 'F' ? 'Faltante' : indicador === 'S' ? 'Sobrante' : 'Cuadra';
  }

  /** "2026-10-31" → "31/10/2026" sin pasar por Date, que la tomaría como UTC y mostraría el día anterior. */
  fechaCorta(iso: string | null | undefined): string {
    if (!iso) return '';
    const [anio, mes, dia] = iso.substring(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  }

  /** "2026-10-31T18:05:12" → "31/10/2026 18:05". */
  fechaHora(iso: string | null | undefined): string {
    if (!iso) return '';
    return `${this.fechaCorta(iso)} ${iso.substring(11, 16)}`;
  }

  /** Importe con signo de menos al frente: "-$1,000.00". */
  pesos(valor: number | null | undefined): string {
    if (valor == null) return '';
    const texto = Math.abs(valor).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (valor < 0 ? '-$' : '$') + texto;
  }

  /** Lo que un movimiento suma (+) o resta (-) a la bóveda o a la ventanilla en el bloque inferior. */
  signado(valor: number | null | undefined, signo: 1 | -1): string {
    if (valor == null) return '';
    const neto = valor * signo;
    return (neto > 0 ? '+' : '') + this.pesos(neto);
  }
}
