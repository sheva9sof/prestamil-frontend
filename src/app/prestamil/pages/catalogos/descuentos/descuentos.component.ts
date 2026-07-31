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

interface TipoPrenda {
  id: number;
  tipo?: string;
  nombre?: string;
}

interface Descuento {
  id: number;
  descripcion: string;
  porcentaje: number;
  idTipoPrenda: number;
  tipoPrenda: string;
  estatus: 'ACTIVO' | 'INACTIVO';
  fechaInicio: string;
  fechaFin: string;
}

const MOCK_DESCUENTOS: Descuento[] = [
  {
    id: 1,
    descripcion: 'Descuento Clientes Frecuentes',
    porcentaje: 10,
    idTipoPrenda: 1,
    tipoPrenda: 'ALHAJA',
    estatus: 'ACTIVO',
    fechaInicio: '2025-01-01',
    fechaFin: '2025-12-31'
  },
  {
    id: 2,
    descripcion: 'Descuento Temporada Verano',
    porcentaje: 15,
    idTipoPrenda: 3,
    tipoPrenda: 'VARIOS',
    estatus: 'INACTIVO',
    fechaInicio: '2025-06-01',
    fechaFin: '2025-08-31'
  }
];

@Component({
  selector: 'app-descuentos',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './descuentos.component.html',
  styleUrls: ['./descuentos.component.scss']
})
export class DescuentosComponent implements OnInit {
  @ViewChild('descuentoModal') descuentoModalTemplate!: TemplateRef<any>;

  filtroTipoPrenda: string = '';
  terminoBusqueda: string = '';

  descuentos: Descuento[] = [...MOCK_DESCUENTOS];
  descuentosFiltrados: Descuento[] = [];
  tiposPrenda: TipoPrenda[] = [];
  isLoadingTipos = false;

  // Paginación
  paginaActual = 1;
  itemsPorPagina = 10;
  totalPaginas = 0;

  // Modal
  descuentoModalRef: NgbModalRef | null = null;
  isEditingDescuento = false;
  idEdicion: number | null = null;
  modalError = '';
  isLoadingGuardar = false;
  private nextId = MOCK_DESCUENTOS.length + 1;

  formData: {
    descripcion: string;
    porcentaje: number | null;
    idTipoPrenda: string;
    estatus: 'ACTIVO' | 'INACTIVO';
    fechaInicio: string;
    fechaFin: string;
  } = this.emptyForm();

  Math = Math;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.cargarTiposPrenda();
    this.aplicarFiltros();
  }

  cargarTiposPrenda(): void {
    this.isLoadingTipos = true;
    this.http
      .get<TipoPrenda[]>(`${environment.apiUrl}/api/prendas/tipos`, { withCredentials: true })
      .pipe(catchError(() => { this.isLoadingTipos = false; return of([]); }))
      .subscribe(data => {
        this.tiposPrenda = data.map(t => ({ id: Number(t.id), tipo: t.tipo ?? t.nombre ?? '' }));
        this.isLoadingTipos = false;
      });
  }

  onFiltroChange(): void {
    this.paginaActual = 1;
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    let filtrados = this.descuentos;

    if (this.filtroTipoPrenda) {
      filtrados = filtrados.filter(d => d.idTipoPrenda === Number(this.filtroTipoPrenda));
    }

    if (this.terminoBusqueda.trim()) {
      const q = this.terminoBusqueda.toLowerCase().trim();
      filtrados = filtrados.filter(d =>
        d.descripcion.toLowerCase().includes(q) ||
        d.tipoPrenda.toLowerCase().includes(q) ||
        d.estatus.toLowerCase().includes(q) ||
        String(d.porcentaje).includes(q)
      );
    }

    this.descuentosFiltrados = filtrados;
    this.calcularPaginacion();
  }

  calcularPaginacion(): void {
    this.totalPaginas = Math.ceil(this.descuentosFiltrados.length / this.itemsPorPagina);
    if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
      this.paginaActual = 1;
    }
  }

  get descuentosPaginados(): Descuento[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.descuentosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  getPaginas(): number[] {
    const paginas: number[] = [];
    const max = 5;
    if (this.totalPaginas <= max) {
      for (let i = 1; i <= this.totalPaginas; i++) paginas.push(i);
    } else {
      let inicio = Math.max(1, this.paginaActual - 2);
      const fin = Math.min(this.totalPaginas, inicio + max - 1);
      if (fin - inicio < max - 1) inicio = Math.max(1, fin - max + 1);
      for (let i = inicio; i <= fin; i++) paginas.push(i);
    }
    return paginas;
  }

  abrirModalNuevo(): void {
    this.isEditingDescuento = false;
    this.idEdicion = null;
    this.modalError = '';
    this.formData = this.emptyForm();
    this.descuentoModalRef = this.modalService.open(this.descuentoModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'lg',
      windowClass: 'edit-modal'
    });
  }

  editarDescuento(d: Descuento): void {
    this.isEditingDescuento = true;
    this.idEdicion = d.id;
    this.modalError = '';
    this.formData = {
      descripcion: d.descripcion,
      porcentaje: d.porcentaje,
      idTipoPrenda: String(d.idTipoPrenda),
      estatus: d.estatus,
      fechaInicio: d.fechaInicio,
      fechaFin: d.fechaFin
    };
    this.descuentoModalRef = this.modalService.open(this.descuentoModalTemplate, {
      backdrop: 'static',
      keyboard: false,
      centered: true,
      size: 'lg',
      windowClass: 'edit-modal'
    });
  }

  closeModal(): void {
    this.descuentoModalRef?.close();
    this.descuentoModalRef = null;
    this.modalError = '';
    this.formData = this.emptyForm();
  }

  guardarDescuento(): void {
    const { descripcion, porcentaje, idTipoPrenda, estatus, fechaInicio, fechaFin } = this.formData;

    if (!descripcion.trim() || porcentaje === null || !idTipoPrenda || !fechaInicio || !fechaFin) {
      this.modalError = 'Por favor complete todos los campos obligatorios.';
      return;
    }
    if (Number(porcentaje) < 0 || Number(porcentaje) > 100) {
      this.modalError = 'El porcentaje debe estar entre 0 y 100.';
      return;
    }

    const tipo = this.tiposPrenda.find(t => t.id === Number(idTipoPrenda));
    const tipoPrendaNombre = tipo?.tipo ?? '';

    if (this.isEditingDescuento && this.idEdicion !== null) {
      const idx = this.descuentos.findIndex(d => d.id === this.idEdicion);
      if (idx !== -1) {
        this.descuentos[idx] = {
          id: this.idEdicion,
          descripcion: descripcion.trim(),
          porcentaje: Number(porcentaje),
          idTipoPrenda: Number(idTipoPrenda),
          tipoPrenda: tipoPrendaNombre,
          estatus,
          fechaInicio,
          fechaFin
        };
      }
    } else {
      this.descuentos.push({
        id: this.nextId++,
        descripcion: descripcion.trim(),
        porcentaje: Number(porcentaje),
        idTipoPrenda: Number(idTipoPrenda),
        tipoPrenda: tipoPrendaNombre,
        estatus,
        fechaInicio,
        fechaFin
      });
    }

    this.aplicarFiltros();
    this.closeModal();
  }

  trackById(_: number, item: Descuento): number {
    return item.id;
  }

  private emptyForm() {
    return {
      descripcion: '',
      porcentaje: null as number | null,
      idTipoPrenda: '',
      estatus: 'ACTIVO' as 'ACTIVO' | 'INACTIVO',
      fechaInicio: '',
      fechaFin: ''
    };
  }
}
