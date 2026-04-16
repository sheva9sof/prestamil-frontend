// angular import
import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from 'src/environments/environment';

interface Empresa {
  id: number;
  nombre: string;
  razonSocial: string;
  calle: string | null;
  noExterior: string | null;
  noInterior: string | null;
  colonia: string | null;
  delegacion: string | null;
  cp: string | null;
  estado: string | null;
  pais: string | null;
}

@Component({
  selector: 'app-empresas',
  standalone: true,
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './empresas.component.html',
  styleUrls: ['./empresas.component.scss']
})
export class EmpresasComponent implements OnInit {
  @ViewChild('loadingModal') loadingModalTemplate!: TemplateRef<any>;
  @ViewChild('empresaModal') empresaModalTemplate!: TemplateRef<any>;
  
  empresas: Empresa[] = [];
  estados: any[] = [];
  isLoading = false;
  isLoadingData = false;
  successMessage = '';
  errorMessage = '';
  currentEmpresa: Empresa | null = null;
  formData: Partial<Empresa> = {};
  isCreating = false;
  loadingModalRef: NgbModalRef | null = null;
  empresaModalRef: NgbModalRef | null = null;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private modalService: NgbModal
  ) {}

  ngOnInit() {
    this.loadInitialData();
  }

  loadInitialData() {
    this.isLoadingData = true;
    this.errorMessage = '';
    
    if (!this.authService.isAuthenticated()) {
      this.isLoadingData = false;
      this.errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    const empresasRequest = this.http.get<any>(`${environment.apiUrl}/api/empresas`, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      catchError(error => {
        console.error('Error al cargar empresas:', error);
        return of({ error: true, data: [] });
      })
    );

    const estadosRequest = this.http.get<any>(`${environment.apiUrl}/api/master-data/estados`, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).pipe(
      catchError(error => {
        console.error('Error al cargar estados:', error);
        return of({ error: true, data: [] });
      })
    );

    forkJoin({
      empresas: empresasRequest,
      estados: estadosRequest
    }).subscribe({
      next: (results) => {
        // Procesar empresas
        if (!results.empresas.error) {
          if (Array.isArray(results.empresas)) {
            this.empresas = results.empresas;
          } else if (results.empresas && Array.isArray(results.empresas.data)) {
            this.empresas = results.empresas.data;
          } else {
            this.empresas = [];
          }
        } else {
          this.empresas = [];
        }

        // Procesar estados
        if (!results.estados.error) {
          if (Array.isArray(results.estados)) {
            this.estados = results.estados;
          } else if (results.estados && Array.isArray(results.estados.data)) {
            this.estados = results.estados.data;
          } else if (results.estados && Array.isArray(results.estados.estados)) {
            this.estados = results.estados.estados;
          } else {
            this.estados = [];
          }
        } else {
          this.estados = [];
        }

        this.isLoadingData = false;
      },
      error: (error) => {
        this.isLoadingData = false;
        this.errorMessage = 'Error al cargar los datos. Por favor, intenta nuevamente.';
        console.error('Error al cargar datos:', error);
      }
    });
  }

  openCreateModal() {
    this.isCreating = true;
    this.currentEmpresa = null;
    this.formData = {
      nombre: '',
      razonSocial: '',
      calle: '',
      noExterior: '',
      noInterior: '',
      colonia: '',
      delegacion: '',
      cp: '',
      estado: '',
      pais: ''
    };
    
    if (this.empresaModalTemplate) {
      this.empresaModalRef = this.modalService.open(this.empresaModalTemplate, {
        backdrop: 'static',
        keyboard: false,
        centered: true,
        size: 'lg',
        windowClass: 'edit-modal'
      });
    }
  }

  openEditModal(empresa: Empresa) {
    this.isCreating = false;
    this.currentEmpresa = empresa;
    this.formData = {
      id: empresa.id,
      nombre: empresa.nombre || '',
      razonSocial: empresa.razonSocial || '',
      calle: empresa.calle || '',
      noExterior: empresa.noExterior || '',
      noInterior: empresa.noInterior || '',
      colonia: empresa.colonia || '',
      delegacion: empresa.delegacion || '',
      cp: empresa.cp || '',
      estado: empresa.estado || '',
      pais: empresa.pais || ''
    };
    
    if (this.empresaModalTemplate) {
      this.empresaModalRef = this.modalService.open(this.empresaModalTemplate, {
        backdrop: 'static',
        keyboard: false,
        centered: true,
        size: 'lg',
        windowClass: 'edit-modal'
      });
    }
  }

  closeEmpresaModal() {
    if (this.empresaModalRef) {
      this.empresaModalRef.close();
      this.empresaModalRef = null;
    }
    this.currentEmpresa = null;
    this.formData = {};
    this.isCreating = false;
  }

  saveEmpresa() {
    if (this.isCreating) {
      this.createEmpresa();
    } else {
      this.updateEmpresa();
    }
  }

  createEmpresa() {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.openLoadingModal('Creando empresa...');

    if (!this.authService.isAuthenticated()) {
      this.isLoading = false;
      this.closeLoadingModal();
      this.errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    const body = {
      nombre: this.formData.nombre || '',
      razonSocial: this.formData.razonSocial || '',
      calle: this.formData.calle || null,
      noExterior: this.formData.noExterior || null,
      noInterior: this.formData.noInterior || null,
      colonia: this.formData.colonia || null,
      delegacion: this.formData.delegacion || null,
      cp: this.formData.cp || null,
      estado: this.formData.estado || null,
      pais: this.formData.pais || null
    };

    const url = `${environment.apiUrl}/api/empresas`;
    
    this.http.post<any>(url, body, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.closeLoadingModal();
        this.closeEmpresaModal();
        
        // Agregar la nueva empresa a la lista
        if (response && response.id) {
          this.empresas.push(response);
        } else {
          // Si la respuesta no incluye el objeto completo, recargar la lista
          this.loadInitialData();
        }
        
        this.successMessage = 'Empresa creada exitosamente';
        this.autoHideSuccessMessage();
      },
      error: (error) => {
        this.isLoading = false;
        this.closeLoadingModal();
        
        if (error.status === 401 || error.status === 403) {
          this.errorMessage = 'No tienes permisos para crear empresas.';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Error al crear la empresa. Verifica los datos ingresados.';
        } else if (error.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al crear la empresa. Por favor, intenta nuevamente.';
        }
        
        console.error('Error al crear empresa:', error);
      }
    });
  }

  updateEmpresa() {
    if (!this.currentEmpresa) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.openLoadingModal('Guardando cambios...');

    if (!this.authService.isAuthenticated()) {
      this.isLoading = false;
      this.closeLoadingModal();
      this.errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    const body = {
      nombre: this.formData.nombre || '',
      razonSocial: this.formData.razonSocial || '',
      calle: this.formData.calle || null,
      noExterior: this.formData.noExterior || null,
      noInterior: this.formData.noInterior || null,
      colonia: this.formData.colonia || null,
      delegacion: this.formData.delegacion || null,
      cp: this.formData.cp || null,
      estado: this.formData.estado || null,
      pais: this.formData.pais || null
    };

    const url = `${environment.apiUrl}/api/empresas/${this.currentEmpresa.id}`;
    
    this.http.put<any>(url, body, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.closeLoadingModal();
        
        // Guardar el ID antes de cerrar el modal
        const empresaId = this.currentEmpresa?.id;
        
        // Actualizar la empresa en la lista antes de cerrar el modal
        if (empresaId) {
          const index = this.empresas.findIndex(e => e.id === empresaId);
          if (index !== -1) {
            this.empresas[index] = { ...this.empresas[index], ...body };
          }
        }
        
        this.closeEmpresaModal();
        this.successMessage = 'Empresa actualizada exitosamente';
        this.autoHideSuccessMessage();
      },
      error: (error) => {
        this.isLoading = false;
        this.closeLoadingModal();
        
        if (error.status === 401 || error.status === 403) {
          this.errorMessage = 'No tienes permisos para actualizar la empresa.';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Error al actualizar la empresa. Verifica los datos ingresados.';
        } else if (error.status === 404) {
          this.errorMessage = 'Empresa no encontrada.';
        } else if (error.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al actualizar la empresa. Por favor, intenta nuevamente.';
        }
        
        console.error('Error al actualizar empresa:', error);
      }
    });
  }

  openLoadingModal(title: string = 'Cargando información') {
    if (this.loadingModalTemplate && !this.loadingModalRef) {
      try {
        this.loadingModalRef = this.modalService.open(this.loadingModalTemplate, {
          backdrop: 'static',
          keyboard: false,
          centered: true,
          size: 'sm',
          windowClass: 'loading-modal'
        });
      } catch (error) {
        console.error('Error al abrir modal:', error);
      }
    }
  }

  closeLoadingModal() {
    if (this.loadingModalRef) {
      try {
        this.loadingModalRef.close();
        this.loadingModalRef = null;
      } catch (error) {
        console.error('Error al cerrar modal:', error);
        this.loadingModalRef = null;
      }
    }
  }

  trackByFn(index: number, item: Empresa): number {
    return item.id;
  }

  autoHideSuccessMessage() {
    setTimeout(() => {
      this.successMessage = '';
    }, 5000);
  }
}


