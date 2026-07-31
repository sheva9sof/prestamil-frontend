import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { OroConfigService } from '../../../core/services/oro-config.service';
import { OroCeldaResponse, PrecioGramoRequest } from '../../../core/models/oro-config.model';

type HechuraCode = 'F' | 'N' | 'E';

/**
 * Pantalla "Configuración del Oro": 3 pestañas (Fundir/Normal/Especial), cada una con
 * una tabla de 8 kilates (6,8,10,12,14,18,21,24K). Permite editar el %Prestamo de las
 * 24 celdas (ORO-05); la fila 24K se muestra como referencia no editable (ORO-07).
 * Incluye el campo de precio del gramo de oro 24K (movido desde /plazos-periodos, D-16)
 * y los 3 factores de ajuste por hechura (Fundir/Normal/Especial), reinstaurados como
 * multiplicador adicional configurable por sucursal sobre el precio de préstamo, que
 * también afecta el monto real ofrecido en contratos nuevos (ORO-09).
 */
@Component({
  selector: 'app-configuracion-oro',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './configuracion-oro.component.html',
  styleUrls: ['./configuracion-oro.component.scss']
})
export class ConfiguracionOroComponent implements OnInit {
  private readonly oroConfigService = inject(OroConfigService);

  sucursalId = 1;
  celdas: OroCeldaResponse[] = [];
  precioGramo: number | null = null;
  factores: Record<HechuraCode, number | null> = { F: null, N: null, E: null };
  isLoading = false;
  isSavingGramo = false;
  successMessage = '';
  errorMessage = '';
  editando: { [key: string]: number | null } = {};
  savingCelda: { [key: string]: boolean } = {};
  porcPrestamoOriginal: { [key: string]: number } = {};

  readonly KILATES = [6, 8, 10, 12, 14, 18, 21, 24];
  readonly HECHURAS: { code: HechuraCode; label: string; icon: string }[] = [
    { code: 'F', label: 'Fundir', icon: 'feather icon-zap' },
    { code: 'N', label: 'Normal', icon: 'feather icon-circle' },
    { code: 'E', label: 'Especial', icon: 'feather icon-star' }
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
   * Carga el precio del gramo de oro 24K y los factores por hechura vigentes;
   * tolera error si aún no hay precio configurado (deja los factores en neutro).
   */
  cargarPrecioGramo(): void {
    this.oroConfigService.getPrecioGramo(this.sucursalId).subscribe({
      next: (data) => {
        this.precioGramo = data?.precioGramo24k ?? null;
        this.factores = {
          F: data?.factorFundir ?? 100,
          N: data?.factorNormal ?? 100,
          E: data?.factorEspecial ?? 100
        };
      },
      error: () => {
        this.precioGramo = null;
        this.factores = { F: 100, N: 100, E: 100 };
      }
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

  obtenerCelda(kilataje: number, hechura: HechuraCode): OroCeldaResponse | undefined {
    return this.celdas.find((c) => c.kilataje === kilataje && c.hechura === hechura);
  }

  /**
   * Muestra el avalúo de referencia con el factor de la hechura capturado en el
   * formulario, incluso antes de guardar y recalcular en el servidor.
   */
  precioAvaluoConFactor(c: OroCeldaResponse): number {
    const factor = this.factores[c.hechura as keyof typeof this.factores];
    const factorNumerico = Number(factor);

    if (factor === null || factor === undefined || !Number.isFinite(factorNumerico) || factorNumerico < 0) {
      return c.precioAvaluo;
    }

    return c.precioAvaluo * (factorNumerico / 100);
  }

  /**
   * Vista previa proporcional de Configuración de Oro:
   * precio base = avalúo ajustado por hechura × (% préstamo / 100).
   */
  precioPrestamoVista(c: OroCeldaResponse): number {
    const porcentaje = Number(c.porcPrestamo);
    if (!Number.isFinite(porcentaje) || porcentaje < 0) {
      return c.precioPrestamo;
    }
    return this.precioAvaluoConFactor(c) * (porcentaje / 100);
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

  recordarPorcPrestamo(c: OroCeldaResponse): void {
    this.porcPrestamoOriginal = {
      ...this.porcPrestamoOriginal,
      [this.keyCelda(c)]: Number(c.porcPrestamo)
    };
  }

  guardarPorcPrestamoRapido(c: OroCeldaResponse): void {
    if (!c.editable) return;
    const key = this.keyCelda(c);
    const original = this.porcPrestamoOriginal[key];
    const valor = Number(c.porcPrestamo);

    if (original !== undefined && valor === original) return;
    if (!Number.isFinite(valor) || valor < 0) {
      if (original !== undefined) c.porcPrestamo = original;
      this.errorMessage = 'El porcentaje de préstamo debe ser mayor o igual a cero';
      return;
    }

    this.savingCelda = { ...this.savingCelda, [key]: true };
    this.errorMessage = '';
    this.oroConfigService.actualizarCelda(c.kilataje, c.hechura, valor, this.sucursalId).subscribe({
      next: (updated) => {
        this.celdas = this.celdas.map((item) =>
          item.kilataje === updated.kilataje && item.hechura === updated.hechura ? updated : item
        );
        const { [key]: _, ...resto } = this.savingCelda;
        this.savingCelda = resto;
        this.porcPrestamoOriginal = {
          ...this.porcPrestamoOriginal,
          [key]: Number(updated.porcPrestamo)
        };
      },
      error: (err) => {
        if (original !== undefined) c.porcPrestamo = original;
        const { [key]: _, ...resto } = this.savingCelda;
        this.savingCelda = resto;
        this.errorMessage = 'Error al actualizar el porcentaje: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  /**
   * Guarda el nuevo precio del gramo de oro 24K y los 3 factores de ajuste por hechura,
   * y recalcula todas las tablas de la sucursal.
   */
  guardarPrecioGramo(): void {
    if (!this.precioGramo || this.precioGramo <= 0) return;
    const { F, N, E } = this.factores;
    const factoresInvalidos = [F, N, E].some((f) => f === null || f === undefined || isNaN(Number(f)) || Number(f) < 0);
    if (factoresInvalidos) {
      this.errorMessage = 'Los factores por hechura deben ser mayores o iguales a cero';
      return;
    }
    this.isSavingGramo = true;
    this.errorMessage = '';
    const body: PrecioGramoRequest = {
      precioGramoBase: this.precioGramo,
      factorFundir: F ?? undefined,
      factorNormal: N ?? undefined,
      factorEspecial: E ?? undefined
    };
    this.oroConfigService.actualizarPrecioGramo(body, this.sucursalId).subscribe({
      next: () => {
        this.isSavingGramo = false;
        this.successMessage = 'Precio del gramo y factores por hechura guardados. Tablas recalculadas.';
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

  trackByKilataje(_index: number, kilataje: number): number {
    return kilataje;
  }

  private autoHideSuccessMessage(): void {
    setTimeout(() => { this.successMessage = ''; }, 4000);
  }
}
