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

interface Prenda {
  idValorAtributo: number;
  idAtributo: number;
  nombreAtributo: string;
  idTipoPrenda: number;
  tipo: string;
  /** Respuestas antiguas; preferir `descripcion`. */
  valor?: string | null;
  clave?: string | null;
  descripcion?: string | null;
  kilataje?: string | null;
  contienePiedad?: boolean | null;
}

interface TipoPrenda {
  id: number;
  /** Etiqueta (API suele enviar `tipo`; compatibilidad con `nombre`). */
  tipo?: string;
  nombre?: string;
}

interface Categoria {
  idAtributo: number;
  nombreAtributo: string;
}

@Component({
  selector: 'app-prendas',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './prendas.component.html',
  styleUrls: ['./prendas.component.scss']
})
export class PrendasComponent implements OnInit {
  @ViewChild('prendaModal') prendaModalTemplate!: TemplateRef<any>;
  
  filtroTipoPrenda: string = '';
  filtroCategoria: string = '';
  prendas: Prenda[] = [];
  prendasFiltradas: Prenda[] = [];
  tiposPrenda: TipoPrenda[] = [];
  categorias: Categoria[] = [];
  isLoadingTipos: boolean = false;
  isLoadingCategorias: boolean = false;
  isLoadingPrendas: boolean = false;
  
  // Paginación
  terminoBusqueda: string = '';
  paginaActual: number = 1;
  itemsPorPagina: number = 10;
  totalPaginas: number = 0;

  // Modal
  prendaModalRef: NgbModalRef | null = null;
  formData: {
    tipoPrenda: string;
    categoria: string;
    descripcion: string;
    clave: string;
    kilataje: string;
    contienePiedad: boolean;
  } = {
    tipoPrenda: '',
    categoria: '',
    descripcion: '',
    clave: '',
    kilataje: '',
    contienePiedad: false
  };
  categoriasModal: Categoria[] = [];
  isLoadingCategoriasModal: boolean = false;
  isLoadingGuardar: boolean = false;
  isEditingPrenda = false;
  idValorAtributoEdicion: number | null = null;
  modalError = '';

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private modalService: NgbModal
  ) {}

  ngOnInit(): void {
    this.cargarTiposPrenda();
  }

  cargarTiposPrenda(): void {
    this.isLoadingTipos = true;

    if (!this.authService.isAuthenticated()) {
      console.error('No hay sesión activa');
      this.isLoadingTipos = false;
      return;
    }

    this.http.get<TipoPrenda[]>(`${environment.apiUrl}/api/prendas/tipos`, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      catchError(error => {
        console.error('Error al cargar tipos de prenda:', error);
        this.isLoadingTipos = false;
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.tiposPrenda = (data ?? []).map((t) => ({
          id: Number(t.id),
          tipo: (t as TipoPrenda & { tipo?: string }).tipo ?? t.nombre ?? '',
          nombre: t.nombre
        }));
        this.isLoadingTipos = false;
      },
      error: (error) => {
        console.error('Error al cargar tipos de prenda:', error);
        this.isLoadingTipos = false;
      }
    });
  }

  onTipoPrendaChange(): void {
    // Limpiar la categoría seleccionada cuando cambia el tipo
    this.filtroCategoria = '';
    this.categorias = [];
    
    // Si hay un tipo seleccionado, cargar las categorías
    if (this.filtroTipoPrenda) {
      this.cargarCategorias(Number(this.filtroTipoPrenda));
    }
  }

  cargarCategorias(tipoId: number): void {
    this.isLoadingCategorias = true;

    if (!this.authService.isAuthenticated()) {
      console.error('No hay sesión activa');
      this.isLoadingCategorias = false;
      return;
    }

    this.http.get<Categoria[]>(`${environment.apiUrl}/api/prendas/subtipos/${tipoId}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      catchError(error => {
        console.error('Error al cargar categorías:', error);
        this.isLoadingCategorias = false;
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.categorias = data;
        this.isLoadingCategorias = false;
      },
      error: (error) => {
        console.error('Error al cargar categorías:', error);
        this.isLoadingCategorias = false;
      }
    });
  }

  buscar(): void {
    // Validar que haya una categoría seleccionada
    if (!this.filtroCategoria) {
      console.warn('Por favor seleccione una categoría para buscar');
      return;
    }

    this.isLoadingPrendas = true;

    if (!this.authService.isAuthenticated()) {
      console.error('No hay sesión activa');
      this.isLoadingPrendas = false;
      return;
    }

    this.http.get<Prenda[]>(`${environment.apiUrl}/api/prendas/valores/${this.filtroCategoria}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      catchError(error => {
        console.error('Error al cargar prendas:', error);
        this.isLoadingPrendas = false;
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.prendas = data;
        this.aplicarFiltros();
        this.isLoadingPrendas = false;
      },
      error: (error) => {
        console.error('Error al cargar prendas:', error);
        this.prendas = [];
        this.prendasFiltradas = [];
        this.isLoadingPrendas = false;
      }
    });
  }

  aplicarFiltros(): void {
    // Filtrar por término de búsqueda
    let filtradas = this.prendas;
    
    if (this.terminoBusqueda.trim()) {
      const busqueda = this.terminoBusqueda.toLowerCase().trim();
      filtradas = this.prendas.filter((prenda) => {
        const texto = (s: string | null | undefined) => (s ?? '').toLowerCase();
        return (
          texto(prenda.tipo).includes(busqueda) ||
          texto(prenda.nombreAtributo).includes(busqueda) ||
          texto(prenda.valor).includes(busqueda) ||
          texto(prenda.descripcion).includes(busqueda) ||
          texto(prenda.clave).includes(busqueda) ||
          texto(prenda.kilataje).includes(busqueda)
        );
      });
    }
    
    this.prendasFiltradas = filtradas;
    this.calcularPaginacion();
  }

  calcularPaginacion(): void {
    this.totalPaginas = Math.ceil(this.prendasFiltradas.length / this.itemsPorPagina);
    if (this.paginaActual > this.totalPaginas && this.totalPaginas > 0) {
      this.paginaActual = 1;
    }
  }

  get prendasPaginadas(): Prenda[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    const fin = inicio + this.itemsPorPagina;
    return this.prendasFiltradas.slice(inicio, fin);
  }

  cambiarPagina(pagina: number): void {
    if (pagina >= 1 && pagina <= this.totalPaginas) {
      this.paginaActual = pagina;
    }
  }

  onBusquedaChange(): void {
    this.paginaActual = 1;
    this.aplicarFiltros();
  }

  agregarPrenda(): void {
    this.isEditingPrenda = false;
    this.idValorAtributoEdicion = null;
    this.modalError = '';
    this.formData = {
      tipoPrenda: '',
      categoria: '',
      descripcion: '',
      clave: '',
      kilataje: '',
      contienePiedad: false
    };
    this.categoriasModal = [];
    
    if (this.prendaModalTemplate) {
      this.prendaModalRef = this.modalService.open(this.prendaModalTemplate, {
        backdrop: 'static',
        keyboard: false,
        centered: true,
        size: 'lg',
        windowClass: 'edit-modal'
      });
    }
  }

  closePrendaModal(): void {
    if (this.prendaModalRef) {
      this.prendaModalRef.close();
      this.prendaModalRef = null;
    }
    this.isEditingPrenda = false;
    this.idValorAtributoEdicion = null;
    this.modalError = '';
    this.formData = {
      tipoPrenda: '',
      categoria: '',
      descripcion: '',
      clave: '',
      kilataje: '',
      contienePiedad: false
    };
    this.categoriasModal = [];
  }

  textoPrenda(prenda: Prenda): string {
    const d = prenda.descripcion?.trim();
    if (d) {
      return d;
    }
    const v = prenda.valor?.trim();
    return v ?? '—';
  }

  textoCelda(s: string | null | undefined): string {
    const t = (s ?? '').trim();
    return t ? t : '—';
  }

  onTipoPrendaModalChange(): void {
    // Limpiar la categoría seleccionada cuando cambia el tipo
    this.formData.categoria = '';
    this.categoriasModal = [];
    
    // Si hay un tipo seleccionado, cargar las categorías
    if (this.formData.tipoPrenda) {
      this.cargarCategoriasModal(Number(this.formData.tipoPrenda));
    }
  }

  cargarCategoriasModal(
    tipoId: number,
    opciones?: { preseleccionarCategoria?: string }
  ): void {
    this.isLoadingCategoriasModal = true;

    if (!this.authService.isAuthenticated()) {
      console.error('No hay sesión activa');
      this.isLoadingCategoriasModal = false;
      return;
    }

    this.http.get<Categoria[]>(`${environment.apiUrl}/api/prendas/subtipos/${tipoId}`, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      catchError(error => {
        console.error('Error al cargar categorías:', error);
        this.isLoadingCategoriasModal = false;
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.categoriasModal = data;
        this.isLoadingCategoriasModal = false;
        if (opciones?.preseleccionarCategoria != null && opciones.preseleccionarCategoria !== '') {
          this.formData.categoria = opciones.preseleccionarCategoria;
        }
      },
      error: (error) => {
        console.error('Error al cargar categorías:', error);
        this.isLoadingCategoriasModal = false;
      }
    });
  }

  guardarPrenda(): void {
    if (!this.formData.tipoPrenda || !this.formData.categoria || !this.formData.descripcion.trim()) {
      console.warn('Por favor complete todos los campos obligatorios');
      return;
    }

    this.isLoadingGuardar = true;
    this.modalError = '';

    if (!this.authService.isAuthenticated()) {
      console.error('No hay sesión activa');
      this.isLoadingGuardar = false;
      this.modalError = 'No hay sesión activa.';
      return;
    }

    const idTipoPrenda = Number(this.formData.tipoPrenda);
    const idAtributo = Number(this.formData.categoria);
    const descripcion = this.formData.descripcion.trim();
    const clave = this.formData.clave.trim() || null;
    const kilataje = this.formData.kilataje.trim() || null;

    if (!Number.isFinite(idTipoPrenda) || !Number.isFinite(idAtributo)) {
      this.isLoadingGuardar = false;
      this.modalError = 'Tipo o categoría no válidos.';
      return;
    }

    const body = {
      idTipoPrenda,
      idAtributo,
      descripcion,
      clave,
      kilataje,
      contienePiedad: this.formData.contienePiedad
    };

    if (this.isEditingPrenda && this.idValorAtributoEdicion != null) {
      const url = `${environment.apiUrl}/api/prendas/valores/${this.idValorAtributoEdicion}`;
      this.http
        .put<Prenda>(url, body, {
          headers: { 'Content-Type': 'application/json' },
          withCredentials: true
        })
        .subscribe({
          next: () => {
            this.isLoadingGuardar = false;
            this.closePrendaModal();
            if (this.filtroCategoria) {
              this.buscar();
            }
          },
          error: (err) => {
            this.isLoadingGuardar = false;
            this.modalError =
              err.error?.message || 'No se pudo actualizar el valor. Intenta de nuevo.';
            console.error('Error al actualizar prenda:', err);
          }
        });
      return;
    }

    const url = `${environment.apiUrl}/api/prendas/valores`;
    this.http
      .post<Prenda>(url, body, {
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true
      })
      .subscribe({
        next: () => {
          this.isLoadingGuardar = false;
          this.closePrendaModal();
          if (this.filtroCategoria) {
            this.buscar();
          }
        },
        error: (err) => {
          this.isLoadingGuardar = false;
          this.modalError =
            err.error?.message || 'No se pudo crear el valor. Intenta de nuevo.';
          console.error('Error al crear prenda:', err);
        }
      });
  }

  editarPrenda(prenda: Prenda): void {
    this.modalError = '';
    this.isEditingPrenda = true;
    this.idValorAtributoEdicion = prenda.idValorAtributo;
    this.formData = {
      tipoPrenda: String(prenda.idTipoPrenda),
      categoria: String(prenda.idAtributo),
      descripcion: (prenda.descripcion ?? prenda.valor ?? '').toString(),
      clave: (prenda.clave ?? '').toString(),
      kilataje: (prenda.kilataje ?? '').toString(),
      contienePiedad: !!prenda.contienePiedad
    };
    this.categoriasModal = [];
    this.cargarCategoriasModal(prenda.idTipoPrenda, {
      preseleccionarCategoria: String(prenda.idAtributo)
    });

    if (this.prendaModalTemplate) {
      this.prendaModalRef = this.modalService.open(this.prendaModalTemplate, {
        backdrop: 'static',
        keyboard: false,
        centered: true,
        size: 'lg',
        windowClass: 'edit-modal'
      });
    }
  }

  trackByFn(index: number, item: Prenda): number {
    return item.idValorAtributo;
  }

  getPaginas(): number[] {
    const paginas: number[] = [];
    const maxPaginas = 5; // Mostrar máximo 5 números de página
    
    if (this.totalPaginas <= maxPaginas) {
      // Si hay pocas páginas, mostrar todas
      for (let i = 1; i <= this.totalPaginas; i++) {
        paginas.push(i);
      }
    } else {
      // Mostrar páginas alrededor de la actual
      let inicio = Math.max(1, this.paginaActual - 2);
      let fin = Math.min(this.totalPaginas, inicio + maxPaginas - 1);
      
      if (fin - inicio < maxPaginas - 1) {
        inicio = Math.max(1, fin - maxPaginas + 1);
      }
      
      for (let i = inicio; i <= fin; i++) {
        paginas.push(i);
      }
    }
    
    return paginas;
  }

  // Exponer Math para usar en el template
  Math = Math;
}

