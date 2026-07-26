import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OroConfigService } from '../../../core/services/oro-config.service';
import { OroCeldaResponse } from '../../../core/models/oro-config.model';

/**
 * Pantalla "Configuración del Oro": 3 pestañas (Fundir/Normal/Especial), cada una con
 * una tabla de 8 kilates (6,8,10,12,14,18,21,24K). Permite editar el %Prestamo de las
 * 24 celdas (ORO-05); la fila 24K se muestra como referencia no editable (ORO-07).
 * Incluye el campo de precio del gramo de oro 24K (movido desde /plazos-periodos, D-16).
 */
@Component({
  selector: 'app-configuracion-oro',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule, NgbNavModule],
  templateUrl: './configuracion-oro.component.html',
  styleUrls: ['./configuracion-oro.component.scss']
})
export class ConfiguracionOroComponent implements OnInit {
  private readonly oroConfigService = inject(OroConfigService);

  sucursalId = 1;
  celdas: OroCeldaResponse[] = [];
  precioGramo: number | null = null;
  activeTab = 'F';
  isLoading = false;
  isSavingGramo = false;
  successMessage = '';
  errorMessage = '';
  editando: { [key: string]: number | null } = {};
  savingCelda: { [key: string]: boolean } = {};

  readonly KILATES = [6, 8, 10, 12, 14, 18, 21, 24];
  readonly HECHURAS = [
    { code: 'F', label: 'Fundir' },
    { code: 'N', label: 'Normal' },
    { code: 'E', label: 'Especial' }
  ];

  ngOnInit(): void {
    this.cargarTabla();
    this.cargarPrecioGramo();
  }

  /**
   * Carga las 24 celdas de la tabla de préstamo de oro para la sucursal actual.
   */
  cargarTabla(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.oroConfigService.getTablaOro(this.sucursalId).subscribe({
      next: (data) => {
        this.celdas = Array.isArray(data) ? data : [];
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Error al cargar la tabla de oro: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  /**
   * Carga el precio del gramo de oro 24K vigente; tolera error si aún no hay precio configurado.
   */
  cargarPrecioGramo(): void {
    this.oroConfigService.getPrecioGramo(this.sucursalId).subscribe({
      next: (data) => { this.precioGramo = data?.precioGramo24k ?? null; },
      error: () => { this.precioGramo = null; }
    });
  }

  /**
   * Filtra y ordena las celdas de una hechura según el orden estándar de kilates.
   * @param code código de hechura ('F' | 'N' | 'E')
   * @returns celdas de la hechura ordenadas por kilataje
   */
  celdasDeHechura(code: string): OroCeldaResponse[] {
    return this.celdas
      .filter((c) => c.hechura === code)
      .sort((a, b) => this.KILATES.indexOf(a.kilataje) - this.KILATES.indexOf(b.kilataje));
  }

  keyCelda(c: OroCeldaResponse): string {
    return `${c.kilataje}-${c.hechura}`;
  }

  /**
   * Inicia la edición inline del %Prestamo de una celda (sólo si es editable, i.e. no 24K).
   */
  iniciarEdicion(c: OroCeldaResponse): void {
    if (!c.editable) return;
    this.editando = { ...this.editando, [this.keyCelda(c)]: c.porcPrestamo };
  }

  /**
   * Guarda el nuevo %Prestamo de una celda y dispara la cascada de recálculo en el servidor.
   */
  guardarCelda(c: OroCeldaResponse): void {
    const key = this.keyCelda(c);
    const valor = this.editando[key];
    if (valor === null || valor === undefined || isNaN(Number(valor))) {
      this.cancelarEdicion(c);
      return;
    }
    this.savingCelda = { ...this.savingCelda, [key]: true };
    this.errorMessage = '';
    this.oroConfigService.actualizarCelda(c.kilataje, c.hechura, Number(valor), this.sucursalId).subscribe({
      next: (updated) => {
        const idx = this.celdas.findIndex((x) => x.kilataje === c.kilataje && x.hechura === c.hechura);
        if (idx >= 0) {
          this.celdas = [...this.celdas.slice(0, idx), updated, ...this.celdas.slice(idx + 1)];
        }
        const { [key]: _removed, ...restoEdit } = this.editando;
        this.editando = restoEdit;
        const { [key]: _removedSaving, ...restoSaving } = this.savingCelda;
        this.savingCelda = restoSaving;
        this.successMessage = 'Porcentaje actualizado. Tablas de préstamo recalculadas.';
        this.autoHideSuccessMessage();
      },
      error: (err) => {
        const { [key]: _removedSaving, ...restoSaving } = this.savingCelda;
        this.savingCelda = restoSaving;
        this.errorMessage = 'Error al actualizar el porcentaje: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  cancelarEdicion(c: OroCeldaResponse): void {
    const key = this.keyCelda(c);
    const { [key]: _removed, ...resto } = this.editando;
    this.editando = resto;
  }

  /**
   * Guarda el nuevo precio del gramo de oro 24K y recalcula todas las tablas de la sucursal.
   */
  guardarPrecioGramo(): void {
    if (!this.precioGramo || this.precioGramo <= 0) return;
    this.isSavingGramo = true;
    this.errorMessage = '';
    this.oroConfigService.actualizarPrecioGramo(this.precioGramo, this.sucursalId).subscribe({
      next: () => {
        this.isSavingGramo = false;
        this.successMessage = 'Precio del gramo guardado. Todas las tablas fueron recalculadas.';
        this.autoHideSuccessMessage();
        this.cargarTabla();
      },
      error: (err) => {
        this.isSavingGramo = false;
        this.errorMessage = 'Error al guardar el precio del gramo: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  trackByCelda(_index: number, c: OroCeldaResponse): string {
    return `${c.kilataje}-${c.hechura}`;
  }

  private autoHideSuccessMessage(): void {
    setTimeout(() => { this.successMessage = ''; }, 4000);
  }
}
