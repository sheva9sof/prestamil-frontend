import { Component, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { ArranqueCaja, FolioArranque, SerieFolio } from '../../../core/models/caja.model';
import { CajaService } from '../../../core/services/caja.service';

const NOMBRE_SERIE: Record<SerieFolio, string> = {
  TRASPASO_CAJA: 'Traspasos de caja (ministración, concentración, dotación y recolección)',
  NOTA_VENTA: 'Notas de venta'
};

/**
 * Saldo de arranque de caja (CAJ-06, B-04), solo para Sistemas. Se captura una sola vez por sucursal, el
 * día de la migración: la fecha de arranque, el saldo de la bóveda al abrir ese día y el último folio que
 * emitió COCAE en cada serie, para que la numeración siga desde ahí. Un folio no puede ser menor al último
 * que la serie ya emitió en Prestamil.
 *
 * Mientras Sistemas no lo captura, la pantalla muestra el arranque provisional (el que venía de
 * configuraciones): el corte se ve con él, pero ningún día se puede cerrar. Una vez capturado queda en modo
 * lectura.
 */
@Component({
  selector: 'app-arranque',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './arranque.component.html'
})
export class ArranqueComponent implements OnInit {
  private cajaService = inject(CajaService);
  private modalService = inject(NgbModal);

  @ViewChild('confirmarArranque') confirmarArranqueTpl!: TemplateRef<unknown>;

  arranque: ArranqueCaja | null = null;

  // Captura
  fecha = '';
  saldoBoveda: number | null = null;
  folios: FolioArranque[] = [];

  isLoading = true;
  isGuardando = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoading = true;
    this.cajaService.arranque().subscribe({
      next: (arranque) => {
        this.arranque = arranque;
        // La captura parte de hoy y de los folios que ya emitió cada serie
        this.fecha = arranque.hoy;
        this.saldoBoveda = null;
        this.folios = arranque.folios.map((f) => ({ ...f }));
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo consultar el saldo de arranque.';
      }
    });
  }

  /** Último folio que la serie ya emitió en Prestamil: el de COCAE no puede ser menor. */
  minimo(serie: SerieFolio): number {
    return this.arranque?.folios.find((f) => f.serie === serie)?.ultimoFolio ?? 0;
  }

  get puedeGuardar(): boolean {
    return (
      !!this.fecha &&
      !!this.arranque &&
      this.fecha <= this.arranque.hoy &&
      this.saldoBoveda != null &&
      this.saldoBoveda >= 0 &&
      this.folios.every((f) => f.ultimoFolio != null && Number.isInteger(f.ultimoFolio) && f.ultimoFolio >= this.minimo(f.serie)) &&
      !this.isGuardando
    );
  }

  /** Pide confirmación (no se puede cambiar después) y guarda. */
  guardar(): void {
    if (!this.puedeGuardar) return;
    this.modalService.open(this.confirmarArranqueTpl, { centered: true }).result.then(
      (resultado) => {
        if (resultado !== 'confirmar' || this.saldoBoveda == null) return;
        this.isGuardando = true;
        this.errorMessage = '';
        this.cajaService
          .capturarArranque({ fecha: this.fecha, saldoBoveda: this.saldoBoveda, folios: this.folios })
          .subscribe({
            next: (arranque) => {
              this.isGuardando = false;
              this.arranque = arranque;
              this.successMessage = 'Saldo de arranque capturado. Desde ahora se pueden cerrar días de caja.';
            },
            error: (err) => {
              this.isGuardando = false;
              this.errorMessage = err?.error?.message ?? 'No se pudo guardar el saldo de arranque.';
            }
          });
      },
      () => undefined
    );
  }

  nombreSerie(serie: SerieFolio): string {
    return NOMBRE_SERIE[serie] ?? serie;
  }

  /** "2026-10-31" → "31/10/2026" sin pasar por Date (evita el desfase de UTC). */
  fechaCorta(iso: string | null | undefined): string {
    if (!iso) return '';
    const [anio, mes, dia] = iso.substring(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  }

  fechaHora(iso: string | null | undefined): string {
    if (!iso) return '';
    return `${this.fechaCorta(iso)} ${iso.substring(11, 16)}`;
  }

  pesos(valor: number | null | undefined): string {
    if (valor == null) return '';
    return '$' + valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
