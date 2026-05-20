// angular import
import { Component, OnInit, ViewChild, TemplateRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalRef, NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { environment } from 'src/environments/environment';
import { PlazoService } from '../../../core/services/plazo.service';
import {
  PlazoResponse,
  PlazoRequest,
  PlazoParametroRequest,
  PlazoParametroResponse,
  PlazoHechuraAlhajaRequest,
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
  @ViewChild('detalleModal') detalleModalTemplate!: TemplateRef<unknown>;

  private readonly plazoService = inject(PlazoService);
  private readonly modalService = inject(NgbModal);
  private readonly http = inject(HttpClient);

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
  detalleModalRef: NgbModalRef | null = null;
  tiposPrendaSeleccionados: number[] = [];
  tiposPrendaOriginalesModal: TipoPrendaRef[] = [];

  // === Panel derecho (detalle) ===
  selectedPlazo: PlazoResponse | null = null;
  activeTab: string = 'parametros';
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

  // Task 3 — Tab Parámetros editable
  parametrosForm: { [tipoPrendaId: number]: Partial<PlazoParametroRequest> } = {};
  savingParam: { [tipoPrendaId: number]: boolean } = {};
  paramSaveError: { [tipoPrendaId: number]: string } = {};
  paramSaveSuccess: { [tipoPrendaId: number]: boolean } = {};

  // Preview de avalúo en vivo (Tab 1 Parámetros)
  readonly PREVIEW_PRESTAMO = 1000;

  // Task 4 — Agregar/inicializar alhajas
  nuevaAlhaja: Partial<PlazoHechuraAlhajaRequest> = { kilataje: 14, hechura: 'N', precioBase: 0, porcAumento: 0 };
  isAgregandoAlhaja = false;
  isInicializando = false;
  alhajaError = '';

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
    this.http.get<TipoPrendaRef[]>(`${environment.apiUrl}/api/prendas/tipos`).subscribe({
      next: (data) => { this.tiposPrenda = data ?? []; },
      error: (err) => { console.error('Error cargando tipos de prenda', err); this.tiposPrenda = []; }
    });
  }

  // =========================================================================
  // Selección de plazo en panel izquierdo
  // =========================================================================

  seleccionarPlazo(plazo: PlazoResponse): void {
    this.selectedPlazo = plazo;
    this.tabError = '';
    this.activeTab = 'parametros';
    this.cargarParametros();
    this.detalleModalRef = this.modalService.open(this.detalleModalTemplate, {
      size: 'xl',
      centered: true,
      scrollable: true,
      windowClass: 'modal-detalle-plazo'
    });
  }

  // =========================================================================
  // Tabs dinámicas por tipo de prenda
  // =========================================================================

  get detalleTabs(): Array<{ id: string; label: string; isAlhajas: boolean }> {
    return (this.selectedPlazo?.tiposPrenda ?? []).map(t => ({
      id: this.normalizarNombreTipoPrenda(t),
      label: t.tipo,
      isAlhajas: this.esTipoAlhaja(t)
    }));
  }

  isAlhajasTab(tabId: string): boolean {
    return this.detalleTabs.some(t => t.id === tabId && t.isAlhajas);
  }

  private esTipoAlhaja(tipo: { tipo?: string } | null | undefined): boolean {
    const n = (tipo?.tipo ?? '').trim().toLowerCase();
    return n === 'alhajas' || n === 'alhaja' || n === 'joyeria' || n === 'joyería';
  }

  private normalizarNombreTipoPrenda(tipo: { tipo?: string } | null | undefined): string {
    return (tipo?.tipo ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '') // quitar acentos
      .replace(/[^a-z0-9]+/g, '-')                      // espacios y / a guiones
      .replace(/^-+|-+$/g, '');                          // trim guiones
  }

  cambiarTab(tab: string): void {
    this.activeTab = tab;
    this.tabError = '';
    if (tab === 'parametros') {
      this.cargarParametros();
      return;
    }
    if (this.isAlhajasTab(tab)) {
      this.cargarAlhajas();
    }
  }

  cargarParametros(): void {
    if (!this.selectedPlazo) return;
    this.isLoadingTab = true;
    this.parametros = [];
    this.parametrosForm = {};
    this.plazoService.getParametrosBySucursal(this.selectedPlazo.id, this.sucursalId).subscribe({
      next: (data) => {
        this.parametros = data;
        this.isLoadingTab = false;
        // Pre-popular parametrosForm: una entrada por cada tipo de prenda asociado al plazo
        const tipos = this.selectedPlazo?.tiposPrenda ?? [];
        tipos.forEach(t => {
          const existing = this.parametros.find(p => p.tipoPrendaId === t.id);
          if (existing) {
            this.parametrosForm[t.id] = { ...existing } as Partial<PlazoParametroRequest>;
          } else {
            this.parametrosForm[t.id] = {
              porcInteres: 0,
              porcAlmacen: 0,
              porcGastosAdmin: 0,
              cat: 0,
              numMaxRefrendos: 0,
              porcPrestamoSAvaluo: 0,
              usaAvaluoReal: false,
              porcIncrementoAvaluo: 0,
              diasGraciaSinInteres: 0,
              diasAntesPaseVenta: 0,
              importeMinPrestamo: 0
            };
          }
        });
      },
      error: (err) => {
        this.isLoadingTab = false;
        this.tabError = 'Error al cargar parámetros: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  get alhajasPorHechura(): Array<{ label: string; hechura: string; items: PlazoHechuraAlhajaResponse[] }> {
    // Soporta códigos legacy 'HF'/'HN'/'HE' y nuevos 'F'/'N'/'E'
    return [
      { label: 'Fina',     hechura: 'F', items: this.alhajas.filter(a => (a.hechura ?? '').toUpperCase().endsWith('F')) },
      { label: 'Normal',   hechura: 'N', items: this.alhajas.filter(a => (a.hechura ?? '').toUpperCase().endsWith('N')) },
      { label: 'Especial', hechura: 'E', items: this.alhajas.filter(a => (a.hechura ?? '').toUpperCase().endsWith('E')) }
    ];
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
  // Task 3 — Guardar parámetros editables por tipo de prenda
  // =========================================================================

  guardarParametro(tipoPrendaId: number): void {
    if (!this.selectedPlazo) return;
    this.savingParam[tipoPrendaId] = true;
    this.paramSaveError[tipoPrendaId] = '';
    const form = this.parametrosForm[tipoPrendaId] ?? {};
    this.plazoService.guardarParametro(this.selectedPlazo.id, tipoPrendaId, form as PlazoParametroRequest, this.sucursalId).subscribe({
      next: (saved) => {
        this.savingParam[tipoPrendaId] = false;
        this.paramSaveSuccess[tipoPrendaId] = true;
        const idx = this.parametros.findIndex(p => p.tipoPrendaId === tipoPrendaId);
        if (idx >= 0) this.parametros[idx] = saved; else this.parametros.push(saved);
        setTimeout(() => { this.paramSaveSuccess[tipoPrendaId] = false; }, 3000);
      },
      error: (err) => {
        this.savingParam[tipoPrendaId] = false;
        this.paramSaveError[tipoPrendaId] = err?.error?.message ?? 'Error al guardar';
      }
    });
  }

  // =========================================================================
  // Task 4 — Agregar/inicializar alhajas
  // =========================================================================

  agregarAlhaja(): void {
    if (!this.selectedPlazo) return;
    this.isAgregandoAlhaja = true;
    this.alhajaError = '';
    const req = this.nuevaAlhaja as PlazoHechuraAlhajaRequest;
    this.plazoService.crearAlhaja(this.selectedPlazo.id, req, this.sucursalId).subscribe({
      next: (created) => {
        this.isAgregandoAlhaja = false;
        this.alhajas = [...this.alhajas, created];
        this.nuevaAlhaja = { kilataje: 14, hechura: 'N', precioBase: 0, porcAumento: 0 };
      },
      error: (err) => {
        this.isAgregandoAlhaja = false;
        this.alhajaError = err?.error?.message ?? 'Error al agregar alhaja';
      }
    });
  }

  inicializarTablaEstandar(): void {
    if (!this.selectedPlazo) return;
    this.isInicializando = true;
    this.alhajaError = '';
    const kilatajes = [10, 14, 18, 24];
    const hechuras: Array<'F' | 'N' | 'E'> = ['F', 'N', 'E'];
    const requests = kilatajes.flatMap(k => hechuras.map(h =>
      this.plazoService.crearAlhaja(this.selectedPlazo!.id, {
        kilataje: k, hechura: h, precioBase: 0, porcAumento: 0
      }, this.sucursalId)
    ));
    forkJoin(requests).subscribe({
      next: (results) => {
        this.isInicializando = false;
        this.alhajas = results;
      },
      error: (err) => {
        this.isInicializando = false;
        this.alhajaError = err?.error?.message ?? 'Error al inicializar tabla estándar';
      }
    });
  }

  // =========================================================================
  // CRUD de plazos (modal)
  // =========================================================================

  isTipoPrendaMarcado(tipoId: number): boolean {
    return this.tiposPrendaSeleccionados.some((id) => Number(id) === Number(tipoId));
  }

  onTipoPrendaRadioChange(tipoId: number): void {
    this.tiposPrendaSeleccionados = [Number(tipoId)];
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

  trackByTabId(_index: number, tab: { id: string }): string {
    return tab.id;
  }

  /**
   * Calcula el avalúo de contrato de muestra para el preview en vivo de Tab 1.
   * Usa un préstamo de referencia de $1,000 (configurable vía PREVIEW_PRESTAMO).
   * Fórmula: avaluo = prestamo × (1 + porc / 100). Si usaAvaluoReal=false o porc=0,
   * el avalúo es igual al préstamo.
   *
   * @param tipoPrendaId id del tipo de prenda (clave de parametrosForm)
   * @returns objeto { prestamo, avaluo } con valores numéricos en pesos
   */
  avaluoPreview(tipoPrendaId: number): { prestamo: number; avaluo: number } {
    const prestamo = this.PREVIEW_PRESTAMO;
    const form = this.parametrosForm[tipoPrendaId];
    if (!form || !form.usaAvaluoReal) return { prestamo, avaluo: prestamo };
    const porc = Number(form.porcIncrementoAvaluo ?? 0);
    if (!porc || isNaN(porc)) return { prestamo, avaluo: prestamo };
    const avaluo = prestamo * (1 + porc / 100);
    return { prestamo, avaluo };
  }
}
