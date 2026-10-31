import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DenominacionesModalComponent } from '../../../core/components/denominaciones-modal/denominaciones-modal.component';
import { CorteCaja, CorteCajaRenglon, DesgloseCapturado } from '../../../core/models/caja.model';
import { CajaService } from '../../../core/services/caja.service';

/** Las diferencias de ±0.01–0.03 son normales por redondeo (RC-07). */
const TOLERANCIA_REDONDEO_CENTAVOS = 3;

/**
 * Pantalla del corte de caja (CAJ-07a), todavía sin cierre de día. Muestra los dos bloques de
 * `CorteCajaService` en el orden del PDF de COCAE: arriba los movimientos de ventanilla (solo efectivo),
 * aparte lo cobrado con tarjeta (RC-06) y abajo la bóveda y el arqueo (RC-07, RC-08).
 *
 * El cajero solo ve el corte de hoy (como OTR-01). Si el día es anterior al arranque o no hay saldo de
 * arranque, el servidor manda un aviso y la pantalla lo muestra sin cifras. El arqueo opcional cuenta la
 * gaveta con `denominaciones-modal` y la compara contra lo que dice el sistema; no se guarda.
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

  isLoading = false;
  errorMessage = '';

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

  /** El corte trae cifras; si no, solo se muestra el aviso. */
  get conCifras(): boolean {
    return !!this.corte && !this.corte.aviso;
  }

  /** La gaveta solo se cuenta contra el corte de hoy. */
  get esHoy(): boolean {
    return !!this.corte && this.corte.fecha === this.hoy;
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
    if (!this.conCifras || !this.esHoy) return;
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
