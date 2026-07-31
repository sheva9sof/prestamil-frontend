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
  @ViewChild('eliminarModal') eliminarModalTemplate!: TemplateRef<unknown>;

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
  deletingPlazo: { [id: number]: boolean } = {};
  successMessage = '';
  errorMessage = '';
  modalError = '';
  isCreating = false;

  // Modal de edición
  currentPlazo: PlazoResponse | null = null;
  formData: Partial<PlazoRequest & { id?: number; tiposPrendaRefs?: TipoPrendaRef[] }> = {};
  plazoModalRef: NgbModalRef | null = null;
  detalleModalRef: NgbModalRef | null = null;
  eliminarModalRef: NgbModalRef | null = null;
  plazoAEliminar: PlazoResponse | null = null;
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

  // Input para recálculo masivo del precio del oro (legacy por-plazo)
  precioBaseOroInput: number | null = null;
  isRecalculando = false;

  // Edición inline de precio base en tabla alhajas

  // Task 3 — Tab Parámetros editable
  parametrosForm: { [tipoPrendaId: number]: Partial<PlazoParametroRequest> } = {};
  savingParam: { [tipoPrendaId: number]: boolean } = {};
  paramSaveError: { [tipoPrendaId: number]: string } = {};
  paramSaveSuccess: { [tipoPrendaId: number]: boolean } = {};

  // Preview de avalúo en vivo (Tab 1 Parámetros)
  readonly PREVIEW_PRESTAMO = 1000;

  // Task 4 — Agregar/inicializar alhajas
  readonly KILATAJES_ORO = [6, 8, 10, 12, 14, 18, 21, 24];
  nuevaAlhaja: Partial<PlazoHechuraAlhajaRequest> = { kilataje: 14, hechura: 'N', precioBase: 0, porcAumento: 0 };
  isAgregandoAlhaja = false;
  isInicializando = false;
  alhajaError = '';
  porcAumentoOriginal: { [key: string]: number } = {};
  savingPorcAumento: { [key: string]: boolean } = {};
  isSavingDetalle = false;

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
    this.porcAumentoOriginal = {};
    this.isSavingDetalle = false;
    this.cargarParametros();
    const primeraTab = this.detalleTabs[0];
    this.activeTab = primeraTab ? primeraTab.id : '';
    if (primeraTab?.isAlhajas) this.cargarAlhajas();
    this.detalleModalRef = this.modalService.open(this.detalleModalTemplate, {
      size: 'xl',
      centered: true,
      scrollable: true,
      windowClass: 'modal-detalle-plazo'
    });
  }

  // =========================================================================
  // Tipos de período (Addendum 2)
  // =========================================================================

  readonly TIPOS_PERIODO = [
    { dias: 1,  label: 'Diario' },
    { dias: 7,  label: 'Semanal' },
    { dias: 15, label: 'Quincenal' },
    { dias: 30, label: 'Mensual' }
  ];

  getLabelPeriodo(dias: number | null | undefined): string {
    const d = Number(dias);
    const found = this.TIPOS_PERIODO.find(p => p.dias === d);
    return found?.label ?? (d ? `${d} días` : '—');
  }

  /** "Plazo Semanal de 12 periodos = 84 días máx." */
  getLabelPlazoCompleto(dias: number | null | undefined, periodos: number | null | undefined): string {
    const d = Number(dias) || 0;
    const n = Number(periodos) || 0;
    const periodoLabel = this.getLabelPeriodo(d);
    const total = d * n;
    return `Plazo ${periodoLabel} de ${n} periodos = ${total} días máx.`;
  }

  // =========================================================================
  // Tabs dinámicas por tipo de prenda
  // =========================================================================

  get detalleTabs(): Array<{ id: string; label: string; kind: 'alhaja' | 'plata' | 'varios' | 'otro'; isAlhajas: boolean }> {
    return (this.selectedPlazo?.tiposPrenda ?? [])
      .filter(t => !this.esTipoAutoMoto(t))
      .map(t => {
        const kind = this.tipoPrendaKind(t);
        return {
          id: this.normalizarNombreTipoPrenda(t),
          label: t.tipo,
          kind: kind === 'auto-moto' ? 'otro' : kind, // defensivo: ya filtramos arriba
          isAlhajas: kind === 'alhaja' || kind === 'plata' // ambos usan tabla kilataje/hechura
        };
      });
  }

  isAlhajasTab(tabId: string): boolean {
    return this.detalleTabs.some(t => t.id === tabId && t.isAlhajas);
  }

  esTipoAlhaja(tipo: { tipo?: string } | null | undefined): boolean {
    const n = (tipo?.tipo ?? '').trim().toLowerCase();
    return n === 'alhajas' || n === 'alhaja' || n === 'joyeria' || n === 'joyería';
  }

  esTipoPlata(tipo: { tipo?: string } | null | undefined): boolean {
    const n = (tipo?.tipo ?? '')
      .trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return n === 'plata';
  }

  esTipoVarios(tipo: { tipo?: string } | null | undefined): boolean {
    const n = (tipo?.tipo ?? '')
      .trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return n === 'varios' || n.startsWith('vario');
  }

  esTipoAutoMoto(tipo: { tipo?: string } | null | undefined): boolean {
    const n = (tipo?.tipo ?? '')
      .trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    return ['autos', 'auto', 'motos', 'moto', 'automoviles', 'vehiculos'].includes(n);
  }

  tipoPrendaKind(t: { tipo?: string } | null | undefined): 'alhaja' | 'plata' | 'varios' | 'auto-moto' | 'otro' {
    if (this.esTipoAlhaja(t))   return 'alhaja';
    if (this.esTipoPlata(t))    return 'plata';
    if (this.esTipoVarios(t))   return 'varios';
    if (this.esTipoAutoMoto(t)) return 'auto-moto';
    return 'otro';
  }

  getTipoIdFromTab(tabId: string): number {
    if (!this.selectedPlazo) return 0;
    const found = (this.selectedPlazo.tiposPrenda ?? [])
      .find(t => this.normalizarNombreTipoPrenda(t) === tabId);
    return found?.id ?? 0;
  }

  normalizarNombreTipoPrenda(tipo: { tipo?: string } | null | undefined): string {
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
        // Pre-popular parametrosForm ANTES de bajar isLoadingTab para que el template
        // nunca vea parametrosForm[t.id] === undefined cuando !isLoadingTab sea true.
        const tipos = this.selectedPlazo?.tiposPrenda ?? [];
        const nuevoForm: { [tipoPrendaId: number]: Partial<PlazoParametroRequest> } = {};
        tipos.forEach(t => {
          const existing = this.parametros.find(p => p.tipoPrendaId === t.id);
          if (existing) {
            nuevoForm[t.id] = { ...existing } as Partial<PlazoParametroRequest>;
          } else {
            nuevoForm[t.id] = {
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
        // Asignar como nueva referencia y bajar el flag en una sola microtarea
        this.parametrosForm = nuevoForm;
        this.isLoadingTab = false;
      },
      error: (err) => {
        this.isLoadingTab = false;
        this.tabError = 'Error al cargar parámetros: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
      }
    });
  }

  get alhajasPorHechura(): Array<{ label: string; hechura: string; items: PlazoHechuraAlhajaResponse[] }> {
    // Soporta códigos legacy 'HF'/'HN'/'HE' y nuevos 'F'/'N'/'E'
    const porHechura = (hechura: string): PlazoHechuraAlhajaResponse[] =>
      this.alhajas
        .filter(a => (a.hechura ?? '').toUpperCase().endsWith(hechura))
        .sort((a, b) => this.KILATAJES_ORO.indexOf(a.kilataje) - this.KILATAJES_ORO.indexOf(b.kilataje));

    return [
      { label: 'Fundir', hechura: 'F', items: porHechura('F') },
      { label: 'Normal', hechura: 'N', items: porHechura('N') },
      { label: 'Especial', hechura: 'E', items: porHechura('E') }
    ];
  }

  cargarAlhajas(): void {
    if (!this.selectedPlazo) return;
    this.isLoadingTab = true;
    this.alhajas = [];
    this.plazoService.getTablaAlhajas(this.selectedPlazo.id, this.sucursalId).subscribe({
      next: (data) => {
        this.alhajas = data;
        this.porcAumentoOriginal = data.reduce((valores, alhaja) => {
          valores[this.getAlhajaKey(alhaja)] = Number(alhaja.porcAumento);
          return valores;
        }, {} as { [key: string]: number });
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

  recordarPorcAumento(alhaja: PlazoHechuraAlhajaResponse): void {
    const key = this.getAlhajaKey(alhaja);
    this.porcAumentoOriginal = { ...this.porcAumentoOriginal, [key]: Number(alhaja.porcAumento) };
  }

  validarPorcAumentoTemporal(alhaja: PlazoHechuraAlhajaResponse): void {
    const valor = Number(alhaja.porcAumento);
    if (!Number.isFinite(valor) || valor < 0) {
      this.alhajaError = 'El porcentaje de aumento debe ser mayor o igual a cero.';
      return;
    }

    this.alhajaError = '';
    // Vista previa local: coincide con la fórmula del backend y no persiste hasta confirmar.
    alhaja.precioPrestamo = Math.round(
      Number(alhaja.precioBase) * (1 + valor / 100) * 10000
    ) / 10000;
  }

  cancelarCambiosDetalle(): void {
    if (this.isSavingDetalle) return;
    this.alhajas = this.alhajas.map(alhaja => {
      const original = this.porcAumentoOriginal[this.getAlhajaKey(alhaja)];
      return original === undefined ? alhaja : {
        ...alhaja,
        porcAumento: original,
        precioPrestamo: Math.round(
          Number(alhaja.precioBase) * (1 + original / 100) * 10000
        ) / 10000
      };
    });
    this.alhajaError = '';
    this.detalleModalRef?.dismiss();
    this.detalleModalRef = null;
  }

  confirmarCambiosDetalle(): void {
    if (!this.selectedPlazo || this.isSavingDetalle) return;

    const tieneInvalidos = this.alhajas.some(alhaja => {
      const valor = Number(alhaja.porcAumento);
      return !Number.isFinite(valor) || valor < 0;
    });
    if (tieneInvalidos) {
      this.alhajaError = 'Revisa los porcentajes: todos deben ser mayores o iguales a cero.';
      return;
    }

    const cambios = this.alhajas.filter(alhaja =>
      Number(alhaja.porcAumento) !== this.porcAumentoOriginal[this.getAlhajaKey(alhaja)]
    );
    if (cambios.length === 0) {
      this.detalleModalRef?.close();
      this.detalleModalRef = null;
      return;
    }

    this.isSavingDetalle = true;
    this.alhajaError = '';
    const plazoId = this.selectedPlazo.id;
    forkJoin(cambios.map(alhaja =>
      this.plazoService.actualizarPorcAumento(
        plazoId,
        alhaja.kilataje,
        alhaja.hechura,
        Number(alhaja.porcAumento),
        this.sucursalId
      )
    )).subscribe({
      next: (actualizadas) => {
        const porClave = new Map(actualizadas.map(alhaja => [this.getAlhajaKey(alhaja), alhaja]));
        this.alhajas = this.alhajas.map(alhaja => porClave.get(this.getAlhajaKey(alhaja)) ?? alhaja);
        this.isSavingDetalle = false;
        this.detalleModalRef?.close();
        this.detalleModalRef = null;
        this.successMessage = 'Cambios del plazo guardados correctamente.';
        this.autoHideSuccessMessage();
      },
      error: (err) => {
        this.isSavingDetalle = false;
        this.alhajaError = err?.error?.message ?? 'No fue posible guardar los cambios.';
      }
    });
  }

  guardarPorcAumentoRapido(alhaja: PlazoHechuraAlhajaResponse): void {
    if (!this.selectedPlazo) return;
    const key = this.getAlhajaKey(alhaja);
    const valor = Number(alhaja.porcAumento);
    const original = this.porcAumentoOriginal[key];
    if (original !== undefined && valor === original) return;
    if (!Number.isFinite(valor) || valor < 0) {
      this.alhajaError = 'El porcentaje de aumento debe ser mayor o igual a cero.';
      if (original !== undefined) alhaja.porcAumento = original;
      return;
    }

    this.savingPorcAumento = { ...this.savingPorcAumento, [key]: true };
    this.alhajaError = '';
    this.plazoService.actualizarPorcAumento(
      this.selectedPlazo.id, alhaja.kilataje, alhaja.hechura, valor, this.sucursalId
    ).subscribe({
      next: (updated) => {
        this.alhajas = this.alhajas.map((a) =>
          a.kilataje === updated.kilataje && a.hechura === updated.hechura ? updated : a
        );
        const { [key]: _saving, ...restoSaving } = this.savingPorcAumento;
        this.savingPorcAumento = restoSaving;
        this.porcAumentoOriginal = { ...this.porcAumentoOriginal, [key]: Number(updated.porcAumento) };
      },
      error: (err) => {
        const { [key]: _, ...resto } = this.savingPorcAumento;
        this.savingPorcAumento = resto;
        if (original !== undefined) alhaja.porcAumento = original;
        this.alhajaError = err?.error?.message ?? 'No fue posible actualizar el porcentaje.';
      }
    });
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
    const hechuras: Array<'F' | 'N' | 'E'> = ['F', 'N', 'E'];
    const existentes = new Set(this.alhajas.map((a) => `${a.kilataje}-${a.hechura}`));
    const requests = this.KILATAJES_ORO.flatMap(k => hechuras
      .filter(h => !existentes.has(`${k}-${h}`))
      .map(h =>
      this.plazoService.crearAlhaja(this.selectedPlazo!.id, {
        kilataje: k, hechura: h, precioBase: 0, porcAumento: 0
      }, this.sucursalId)
    ));

    if (requests.length === 0) {
      this.isInicializando = false;
      return;
    }

    forkJoin(requests).subscribe({
      next: (results) => {
        this.isInicializando = false;
        this.alhajas = [...this.alhajas, ...results].sort(
          (a, b) => a.kilataje - b.kilataje || a.hechura.localeCompare(b.hechura)
        );
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

  eliminarPlazo(plazo: PlazoResponse): void {
    this.plazoAEliminar = plazo;
    this.eliminarModalRef = this.modalService.open(this.eliminarModalTemplate, {
      centered: true,
      backdrop: 'static',
      keyboard: false,
      windowClass: 'delete-plazo-modal'
    });
  }

  cerrarEliminarModal(): void {
    this.eliminarModalRef?.dismiss();
    this.eliminarModalRef = null;
    this.plazoAEliminar = null;
  }

  confirmarEliminacionPlazo(): void {
    const plazo = this.plazoAEliminar;
    if (!plazo) return;
    this.deletingPlazo = { ...this.deletingPlazo, [plazo.id]: true };
    this.errorMessage = '';
    this.plazoService.delete(plazo.id).subscribe({
      next: () => {
        const { [plazo.id]: _, ...resto } = this.deletingPlazo;
        this.deletingPlazo = resto;
        this.eliminarModalRef?.close();
        this.eliminarModalRef = null;
        this.plazoAEliminar = null;
        this.plazos = this.plazos.filter((p) => p.id !== plazo.id);
        if (this.selectedPlazo?.id === plazo.id) {
          this.selectedPlazo = null;
          this.parametros = [];
          this.alhajas = [];
        }
        this.successMessage = 'Plazo eliminado correctamente.';
        this.autoHideSuccessMessage();
      },
      error: (err) => {
        const { [plazo.id]: _, ...resto } = this.deletingPlazo;
        this.deletingPlazo = resto;
        this.errorMessage = err?.error?.message ?? 'No fue posible eliminar el plazo.';
        this.eliminarModalRef?.dismiss();
        this.eliminarModalRef = null;
        this.plazoAEliminar = null;
      }
    });
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

  trackByHechura(_index: number, grupo: { hechura: string }): string {
    return grupo.hechura;
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
