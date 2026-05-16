// angular import
import { Component, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PlazoService } from '../../../core/services/plazo.service';
import {
  PlazoResponse,
  PlazoRequest,
  PlazoParametroResponse,
  PlazoHechuraAlhajaResponse
} from '../../../core/models/plazo.model';

interface TipoPrendaRef {
  id: number;
  tipo: string;
}

@Component({
  selector: 'app-plazos-periodos',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule, NgbNavModule],
  templateUrl: './plazos-periodos.component.html',
  styleUrls: ['./plazos-periodos.component.scss']
})
export class PlazosPeriodosComponent implements OnInit {
  @ViewChild('plazoModal') plazoModalTemplate!: TemplateRef<unknown>;

  private readonly plazoService = inject(PlazoService);
  private readonly modalService = inject(NgbModal);

  // === Lista de plazos ===
  plazos: PlazoResponse[] = [];
  tiposPrenda: TipoPrendaRef[] = [];
  filtroTipoPrenda = '';
  isLoadingData = false;
  isLoadingTipos = false;
  isSaving = false;
  successMessage = '';
  errorMessage = '';
  modalError = '';
  isCreating = false;

  // Modal de edición
  currentPlazo: PlazoResponse | null = null;
  formData: Partial<PlazoRequest & { id?: number; tiposPrendaRefs?: TipoPrendaRef[] }> = {};
  plazoModalRef: NgbModalRef | null = null;
  tiposPrendaSeleccionados: number[] = [];
  tiposPrendaOriginalesModal: TipoPrendaRef[] = [];

  // === Panel derecho (detalle) ===
  selectedPlazo: PlazoResponse | null = null;
  activeTab: 'parametros' | 'alhajas' = 'parametros';
  parametros: PlazoParametroResponse[] = [];
  alhajas: PlazoHechuraAlhajaResponse[] = [];
  sucursalId = 1;
  isLoadingTab = false;
  tabError = '';

  // Input para recálculo masivo del precio del oro
  precioBaseOroInput: number | null = null;
  isRecalculando = false;

  // Edición inline de precio base en tabla alhajas
  editandoPrecioBase: { [key: string]: number | null } = {};

  ngOnInit(): void {
    this.loadPlazos();
    this.cargarTiposPrenda();
  }

  // =========================================================================
  // Carga de datos
  // =========================================================================

  loadPlazos(): void {
    this.isLoadingData = true;
    this.errorMessage = '';
    this.plazoService.getAll().subscribe({
      next: (data) => {
        this.plazos = Array.isArray(data) ? data : [];
        this.isLoadingData = false;
      },
      error: (err) => {
        this.isLoadingData = false;
        this.errorMessage = 'Error al cargar plazos: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  cargarTiposPrenda(): void {
    // Los tipos de prenda se cargan desde el plazo seleccionado (plazo.tiposPrenda[])
    // No se requiere endpoint separado para el filtro en esta vista de dos paneles
    this.isLoadingTipos = false;
  }

  // =========================================================================
  // Selección de plazo en panel izquierdo
  // =========================================================================

  seleccionarPlazo(plazo: PlazoResponse): void {
    this.selectedPlazo = plazo;
    this.tabError = '';
    this.activeTab = 'parametros';
    this.cargarParametros();
  }

  cambiarTab(tab: 'parametros' | 'alhajas'): void {
    this.activeTab = tab;
    this.tabError = '';
    if (tab === 'parametros') {
      this.cargarParametros();
    } else {
      this.cargarAlhajas();
    }
  }

  cargarParametros(): void {
    if (!this.selectedPlazo) return;
    this.isLoadingTab = true;
    this.parametros = [];
    this.plazoService.getParametrosBySucursal(this.selectedPlazo.id, this.sucursalId).subscribe({
      next: (data) => {
        this.parametros = data;
        this.isLoadingTab = false;
      },
      error: (err) => {
        this.isLoadingTab = false;
        this.tabError = 'Error al cargar parámetros: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  cargarAlhajas(): void {
    if (!this.selectedPlazo) return;
    this.isLoadingTab = true;
    this.alhajas = [];
    this.editandoPrecioBase = {};
    this.plazoService.getTablaAlhajas(this.selectedPlazo.id, this.sucursalId).subscribe({
      next: (data) => {
        this.alhajas = data;
        this.isLoadingTab = false;
      },
      error: (err) => {
        this.isLoadingTab = false;
        this.tabError = 'Error al cargar tabla de alhajas: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  // =========================================================================
  // Acciones tabla alhajas
  // =========================================================================

  getAlhajaKey(alhaja: PlazoHechuraAlhajaResponse): string {
    return `${alhaja.kilataje}-${alhaja.hechura}`;
  }

  iniciarEdicionPrecio(alhaja: PlazoHechuraAlhajaResponse): void {
    this.editandoPrecioBase[this.getAlhajaKey(alhaja)] = alhaja.precioBase;
  }

  guardarPrecioBase(alhaja: PlazoHechuraAlhajaResponse): void {
    if (!this.selectedPlazo) return;
    const key = this.getAlhajaKey(alhaja);
    const nuevoPrecio = this.editandoPrecioBase[key];
    if (nuevoPrecio === null || nuevoPrecio === undefined || isNaN(Number(nuevoPrecio))) {
      delete this.editandoPrecioBase[key];
      return;
    }
    this.plazoService.actualizarPrecioBase(
      this.selectedPlazo.id,
      alhaja.kilataje,
      alhaja.hechura,
      Number(nuevoPrecio),
      this.sucursalId
    ).subscribe({
      next: (updated) => {
        const idx = this.alhajas.findIndex(a => a.kilataje === alhaja.kilataje && a.hechura === alhaja.hechura);
        if (idx >= 0) this.alhajas[idx] = updated;
        delete this.editandoPrecioBase[key];
        this.successMessage = 'Precio actualizado correctamente.';
        this.autoHideSuccessMessage();
      },
      error: (err) => {
        this.tabError = 'Error al actualizar precio: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
        delete this.editandoPrecioBase[key];
      }
    });
  }

  cancelarEdicionPrecio(alhaja: PlazoHechuraAlhajaResponse): void {
    delete this.editandoPrecioBase[this.getAlhajaKey(alhaja)];
  }

  recalcularTodo(): void {
    if (!this.selectedPlazo || !this.precioBaseOroInput || this.precioBaseOroInput <= 0) return;
    this.isRecalculando = true;
    this.tabError = '';
    this.plazoService.actualizarTodosPrecios(
      this.selectedPlazo.id,
      this.precioBaseOroInput,
      this.sucursalId
    ).subscribe({
      next: (data) => {
        this.alhajas = data;
        this.isRecalculando = false;
        this.successMessage = 'Todos los precios recalculados correctamente.';
        this.autoHideSuccessMessage();
      },
      error: (err) => {
        this.isRecalculando = false;
        this.tabError = 'Error al recalcular precios: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  // =========================================================================
  // CRUD de plazos (modal)
  // =========================================================================

  isTipoPrendaMarcado(tipoId: number): boolean {
    return this.tiposPrendaSeleccionados.some((id) => Number(id) === Number(tipoId));
  }

  onTipoPrendaCheckChange(tipoId: number, checked: boolean): void {
    const id = Number(tipoId);
    if (checked) {
      if (!this.tiposPrendaSeleccionados.some((x) => Number(x) === id)) {
        this.tiposPrendaSeleccionados = [...this.tiposPrendaSeleccionados, id];
      }
    } else {
      this.tiposPrendaSeleccionados = this.tiposPrendaSeleccionados.filter((x) => Number(x) !== id);
    }
  }

  openCreateModal(): void {
    this.modalError = '';
    this.isCreating = true;
    this.currentPlazo = null;
    this.tiposPrendaOriginalesModal = [];
    this.tiposPrendaSeleccionados = [];
    this.formData = {
      nombre: '',
      diasPorPeriodo: 7,
      numeroPeriodos: 12,
      activo: true
    };
    this.plazoModalRef = this.modalService.open(this.plazoModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'lg',
      windowClass: 'edit-modal'
    });
  }

  openEditModal(plazo: PlazoResponse): void {
    this.modalError = '';
    this.isCreating = false;
    this.currentPlazo = plazo;
    this.tiposPrendaOriginalesModal = (plazo.tiposPrenda ?? []).map(t => ({ id: Number(t.id), tipo: String(t.tipo ?? '') }));
    this.tiposPrendaSeleccionados = this.tiposPrendaOriginalesModal.map(t => t.id);
    this.formData = {
      id: plazo.id,
      nombre: plazo.nombre ?? '',
      diasPorPeriodo: plazo.diasPorPeriodo,
      numeroPeriodos: plazo.numeroPeriodos,
      activo: plazo.activo
    };
    this.plazoModalRef = this.modalService.open(this.plazoModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'lg',
      windowClass: 'edit-modal'
    });
  }

  closePlazoModal(): void {
    if (this.plazoModalRef) {
      this.plazoModalRef.close();
      this.plazoModalRef = null;
    }
    this.currentPlazo = null;
    this.formData = {};
    this.tiposPrendaSeleccionados = [];
    this.tiposPrendaOriginalesModal = [];
    this.modalError = '';
    this.isCreating = false;
  }

  guardarPlazo(): void {
    if (!this.formData.nombre?.trim()) return;
    if (!this.isCreating && !this.currentPlazo) return;
    this.isSaving = true;
    this.modalError = '';

    const dias = Number(this.formData.diasPorPeriodo);
    const periodos = Number(this.formData.numeroPeriodos);
    if (!Number.isFinite(dias) || !Number.isFinite(periodos)) {
      this.isSaving = false;
      this.modalError = 'Días por periodo y número de periodos deben ser números válidos.';
      return;
    }

    const request: PlazoRequest = {
      nombre: this.formData.nombre!,
      diasPorPeriodo: dias,
      numeroPeriodos: periodos,
      activo: !!this.formData.activo,
      tiposPrenda: this.tiposPrendaSeleccionados
    };

    if (this.isCreating) {
      this.plazoService.create(request).subscribe({
        next: (created) => {
          this.isSaving = false;
          this.closePlazoModal();
          this.plazos = [...this.plazos, created];
          this.successMessage = 'Plazo creado correctamente.';
          this.autoHideSuccessMessage();
        },
        error: (err) => {
          this.isSaving = false;
          this.modalError = err?.error?.message || 'Error al crear el plazo.';
        }
      });
    } else {
      this.plazoService.update(this.currentPlazo!.id, request).subscribe({
        next: (updated) => {
          this.isSaving = false;
          const editedId = this.currentPlazo?.id;
          this.closePlazoModal();
          const idx = this.plazos.findIndex(p => p.id === editedId);
          if (idx >= 0) {
            this.plazos[idx] = updated;
            this.plazos = [...this.plazos];
          } else {
            this.loadPlazos();
          }
          // Actualizar el plazo seleccionado si es el mismo
          if (this.selectedPlazo?.id === editedId) {
            this.selectedPlazo = updated;
          }
          this.successMessage = 'Plazo actualizado correctamente.';
          this.autoHideSuccessMessage();
        },
        error: (err) => {
          this.isSaving = false;
          this.modalError = err?.error?.message || 'Error al guardar el plazo.';
        }
      });
    }
  }

  // =========================================================================
  // Filtrado y helpers
  // =========================================================================

  get plazosFiltrados(): PlazoResponse[] {
    if (!this.filtroTipoPrenda) return this.plazos;
    const idFiltro = Number(this.filtroTipoPrenda);
    return this.plazos.filter(p =>
      (p.tiposPrenda ?? []).some(t => Number(t.id) === idFiltro)
    );
  }

  private autoHideSuccessMessage(): void {
    setTimeout(() => { this.successMessage = ''; }, 4000);
  }

  trackByFn(_index: number, item: PlazoResponse): number {
    return item.id;
  }

  trackByAlhaja(_index: number, item: PlazoHechuraAlhajaResponse): string {
    return `${item.kilataje}-${item.hechura}`;
  }

  trackByParam(_index: number, item: PlazoParametroResponse): number {
    return item.tipoPrendaId;
  }
}
