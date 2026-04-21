// angular import
import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from 'src/environments/environment';

interface TipoPrendaRef {
  id: number;
  tipo: string;
}

interface Plazo {
  id: number;
  nombre: string;
  diasPorPeriodo: number;
  numeroPeriodos: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
  tiposPrenda: TipoPrendaRef[];
}

@Component({
  selector: 'app-plazos-periodos',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './plazos-periodos.component.html',
  styleUrls: ['./plazos-periodos.component.scss']
})
export class PlazosPeriodosComponent implements OnInit {
  @ViewChild('plazoModal') plazoModalTemplate!: TemplateRef<unknown>;

  plazos: Plazo[] = [];
  tiposPrenda: TipoPrendaRef[] = [];
  /** Filtro de la grilla (mismo patrón que prendas). */
  filtroTipoPrenda = '';
  /** Ids seleccionados en el modal (lista de tipos de prenda). */
  tiposPrendaSeleccionados: number[] = [];
  /** Copia al abrir el modal (edición); fallback si el catálogo aún no cargó o hay ids fuera del catálogo. */
  tiposPrendaOriginalesModal: TipoPrendaRef[] = [];
  isLoadingData = false;
  isLoadingTipos = false;
  isSaving = false;
  successMessage = '';
  errorMessage = '';
  modalError = '';
  isCreating = false;

  currentPlazo: Plazo | null = null;
  formData: Partial<Plazo> = {};
  plazoModalRef: NgbModalRef | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.loadPlazos();
    this.cargarTiposPrenda();
  }

  cargarTiposPrenda(): void {
    this.isLoadingTipos = true;

    if (!this.authService.isAuthenticated()) {
      console.error('No hay sesión activa');
      this.isLoadingTipos = false;
      return;
    }

    this.http
      .get<TipoPrendaRef[]>(`${environment.apiUrl}/api/prendas/tipos`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      })
      .pipe(
        catchError((err) => {
          console.error('Error al cargar tipos de prenda:', err);
          this.isLoadingTipos = false;
          return of([]);
        })
      )
      .subscribe({
        next: (data) => {
          this.tiposPrenda = Array.isArray(data)
            ? data.map((t) => ({ id: Number(t.id), tipo: String(t.tipo) }))
            : [];
          this.isLoadingTipos = false;
        },
        error: () => {
          this.tiposPrenda = [];
          this.isLoadingTipos = false;
        }
      });
  }

  isTipoPrendaMarcado(tipoId: number): boolean {
    const n = Number(tipoId);
    return this.tiposPrendaSeleccionados.some((id) => Number(id) === n);
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
    this.syncFormDataTiposPrendaDesdeSeleccion();
  }

  /** Arma el arreglo para el API desde la selección actual + catálogo + snapshot al abrir el modal. */
  private getTiposPrendaPayload(): TipoPrendaRef[] {
    const originales = this.tiposPrendaOriginalesModal;
    return this.tiposPrendaSeleccionados
      .map((rawId) => {
        const id = Number(rawId);
        if (!Number.isFinite(id)) {
          return null;
        }
        const delCat = this.tiposPrenda.find((t) => Number(t.id) === id);
        if (delCat) {
          return { id: Number(delCat.id), tipo: String(delCat.tipo) };
        }
        const delPlazo = originales.find((t) => Number(t.id) === id);
        return delPlazo
          ? { id: Number(delPlazo.id), tipo: String(delPlazo.tipo) }
          : null;
      })
      .filter((x): x is TipoPrendaRef => x != null);
  }

  private syncFormDataTiposPrendaDesdeSeleccion(): void {
    this.formData.tiposPrenda = this.getTiposPrendaPayload();
  }

  loadPlazos(): void {
    this.isLoadingData = true;
    this.errorMessage = '';

    if (!this.authService.isAuthenticated()) {
      this.isLoadingData = false;
      this.errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    this.http
      .get<Plazo[] | { data: Plazo[] }>(`${environment.apiUrl}/api/plazos`, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      })
      .pipe(
        catchError((err) => {
          console.error('Error al cargar plazos:', err);
          return of({ error: true as const });
        })
      )
      .subscribe({
        next: (res) => {
          this.isLoadingData = false;
          if (res && typeof res === 'object' && 'error' in res && res.error) {
            this.plazos = [];
            this.errorMessage = 'Error al cargar plazos. Por favor, intenta nuevamente.';
            return;
          }
          if (Array.isArray(res)) {
            this.plazos = res;
          } else if (res && Array.isArray((res as { data: Plazo[] }).data)) {
            this.plazos = (res as { data: Plazo[] }).data;
          } else {
            this.plazos = [];
          }
        },
        error: (err) => {
          this.isLoadingData = false;
          this.errorMessage = 'Error al cargar plazos. Por favor, intenta nuevamente.';
          console.error(err);
        }
      });
  }

  get plazosFiltrados(): Plazo[] {
    if (!this.filtroTipoPrenda) {
      return this.plazos;
    }
    const idFiltro = Number(this.filtroTipoPrenda);
    return this.plazos.filter((p) =>
      (p.tiposPrenda ?? []).some((t) => Number(t.id) === idFiltro)
    );
  }

  openCreateModal(): void {
    this.modalError = '';
    this.isCreating = true;
    this.currentPlazo = null;
    this.tiposPrendaOriginalesModal = [];
    this.formData = {
      nombre: '',
      diasPorPeriodo: 7,
      numeroPeriodos: 12,
      activo: true,
      tiposPrenda: []
    };
    this.tiposPrendaSeleccionados = [];

    if (this.authService.isAuthenticated() && this.tiposPrenda.length === 0 && !this.isLoadingTipos) {
      this.cargarTiposPrenda();
    }

    this.plazoModalRef = this.modalService.open(this.plazoModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'lg',
      windowClass: 'edit-modal'
    });
  }

  openEditModal(plazo: Plazo): void {
    this.modalError = '';
    this.isCreating = false;
    this.currentPlazo = plazo;
    this.tiposPrendaOriginalesModal = (plazo.tiposPrenda ?? [])
      .map((t) => ({
        id: Number(t.id),
        tipo: String(t.tipo ?? '')
      }))
      .filter((t) => Number.isFinite(t.id));
    this.formData = {
      id: plazo.id,
      nombre: plazo.nombre ?? '',
      diasPorPeriodo: plazo.diasPorPeriodo,
      numeroPeriodos: plazo.numeroPeriodos,
      activo: plazo.activo,
      tiposPrenda: this.tiposPrendaOriginalesModal.map((t) => ({ ...t }))
    };
    this.tiposPrendaSeleccionados = this.tiposPrendaOriginalesModal.map((t) => t.id);

    if (this.authService.isAuthenticated() && this.tiposPrenda.length === 0 && !this.isLoadingTipos) {
      this.cargarTiposPrenda();
    }

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
    if (this.formData.nombre === undefined || this.formData.nombre === '') {
      return;
    }
    if (!this.isCreating && !this.currentPlazo) {
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.modalError = '';

    if (!this.authService.isAuthenticated()) {
      this.isSaving = false;
      this.modalError = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    const dias = Number(this.formData.diasPorPeriodo);
    const periodos = Number(this.formData.numeroPeriodos);
    if (!Number.isFinite(dias) || !Number.isFinite(periodos)) {
      this.isSaving = false;
      this.modalError = 'Días por periodo y número de periodos deben ser números válidos.';
      return;
    }

    const tiposPrendaRefs = this.getTiposPrendaPayload();
    this.formData.tiposPrenda = tiposPrendaRefs;
    const tiposPrendaIds = tiposPrendaRefs.map((t) => Number(t.id));

    const body = {
      nombre: this.formData.nombre,
      diasPorPeriodo: dias,
      numeroPeriodos: periodos,
      activo: !!this.formData.activo,
      tiposPrenda: tiposPrendaIds
    };

    if (this.isCreating) {
      this.http
        .post<Plazo>(`${environment.apiUrl}/api/plazos`, body, {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true
        })
        .subscribe({
          next: (created) => {
            this.isSaving = false;
            this.closePlazoModal();
            if (created && created.id) {
              this.plazos = [...this.plazos, created];
            } else {
              this.loadPlazos();
            }
            this.successMessage = 'Plazo creado correctamente.';
            this.autoHideSuccessMessage();
          },
          error: (error) => {
            this.isSaving = false;
            this.modalError = this.mapPlazoSaveError(error, true);
            console.error('Error al crear plazo:', error);
          }
        });
      return;
    }

    const url = `${environment.apiUrl}/api/plazos/${this.currentPlazo!.id}`;

    this.http
      .put<Plazo>(url, body, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      })
      .subscribe({
        next: (updated) => {
          this.isSaving = false;
          const editedId = this.currentPlazo?.id;
          this.closePlazoModal();
          const idx = editedId != null ? this.plazos.findIndex((p) => p.id === editedId) : -1;
          if (idx >= 0 && updated && updated.id) {
            this.plazos[idx] = updated;
            this.plazos = [...this.plazos];
          } else {
            this.loadPlazos();
          }
          this.successMessage = 'Plazo actualizado correctamente.';
          this.autoHideSuccessMessage();
        },
        error: (error) => {
          this.isSaving = false;
          this.modalError = this.mapPlazoSaveError(error, false);
          console.error('Error al actualizar plazo:', error);
        }
      });
  }

  private mapPlazoSaveError(error: { status?: number; error?: { message?: string } }, crear: boolean): string {
    if (error.status === 401 || error.status === 403) {
      return crear ? 'No tienes permisos para crear plazos.' : 'No tienes permisos para editar plazos.';
    }
    if (error.status === 400) {
      return error.error?.message || 'Error al guardar. Verifica los datos.';
    }
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    if (error.error?.message) {
      return error.error.message;
    }
    return crear
      ? 'Error al crear el plazo. Por favor, intenta nuevamente.'
      : 'Error al guardar el plazo. Por favor, intenta nuevamente.';
  }

  private autoHideSuccessMessage(): void {
    setTimeout(() => {
      this.successMessage = '';
    }, 4000);
  }

  trackByFn(_index: number, item: Plazo): number {
    return item.id;
  }

  trackByTipoId(_index: number, item: TipoPrendaRef): number {
    return item.id;
  }
}
