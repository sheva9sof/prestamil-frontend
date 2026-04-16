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
  valor: string;
}

interface TipoPrenda {
  id: number;
  nombre: string;
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
    valor: string;
  } = {
    tipoPrenda: '',
    categoria: '',
    valor: ''
  };
  categoriasModal: Categoria[] = [];
  isLoadingCategoriasModal: boolean = false;
  isLoadingGuardar: boolean = false;

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
    const token = this.authService.getToken();
    
    if (!token) {
      console.error('No hay token de autenticación');
      this.isLoadingTipos = false;
      return;
    }

    this.http.get<TipoPrenda[]>(`${environment.apiUrl}/api/prendas/tipos`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).pipe(
      catchError(error => {
        console.error('Error al cargar tipos de prenda:', error);
        this.isLoadingTipos = false;
        return of([]);
      })
    ).subscribe({
      next: (data) => {
        this.tiposPrenda = data;
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
    const token = this.authService.getToken();
    
    if (!token) {
      console.error('No hay token de autenticación');
      this.isLoadingCategorias = false;
      return;
    }

    this.http.get<Categoria[]>(`${environment.apiUrl}/api/prendas/subtipos/${tipoId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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
    const token = this.authService.getToken();
    
    if (!token) {
      console.error('No hay token de autenticación');
      this.isLoadingPrendas = false;
      return;
    }

    this.http.get<Prenda[]>(`${environment.apiUrl}/api/prendas/valores/${this.filtroCategoria}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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
      filtradas = this.prendas.filter(prenda => 
        prenda.tipo.toLowerCase().includes(busqueda) ||
        prenda.nombreAtributo.toLowerCase().includes(busqueda) ||
        prenda.valor.toLowerCase().includes(busqueda)
      );
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
    this.formData = {
      tipoPrenda: '',
      categoria: '',
      valor: ''
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
    this.formData = {
      tipoPrenda: '',
      categoria: '',
      valor: ''
    };
    this.categoriasModal = [];
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

  cargarCategoriasModal(tipoId: number): void {
    this.isLoadingCategoriasModal = true;
    const token = this.authService.getToken();
    
    if (!token) {
      console.error('No hay token de autenticación');
      this.isLoadingCategoriasModal = false;
      return;
    }

    this.http.get<Categoria[]>(`${environment.apiUrl}/api/prendas/subtipos/${tipoId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
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
      },
      error: (error) => {
        console.error('Error al cargar categorías:', error);
        this.isLoadingCategoriasModal = false;
      }
    });
  }

  guardarPrenda(): void {
    // Validar formulario
    if (!this.formData.tipoPrenda || !this.formData.categoria || !this.formData.valor.trim()) {
      console.warn('Por favor complete todos los campos');
      return;
    }

    this.isLoadingGuardar = true;
    const token = this.authService.getToken();
    
    if (!token) {
      console.error('No hay token de autenticación');
      this.isLoadingGuardar = false;
      return;
    }

    // Aquí implementarías la llamada al API para guardar
    // Por ahora solo simulamos el guardado
    setTimeout(() => {
      console.log('Guardando prenda:', this.formData);
      this.isLoadingGuardar = false;
      this.closePrendaModal();
      // Recargar los datos después de guardar
      if (this.filtroCategoria) {
        this.buscar();
      }
    }, 1000);
  }

  editarPrenda(prenda: Prenda): void {
    // Implementar lógica de edición aquí
    console.log('Editando prenda:', prenda);
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

