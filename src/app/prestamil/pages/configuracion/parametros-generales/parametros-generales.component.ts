// angular import
import { Component, OnInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from 'src/environments/environment';

interface ParametroSistema {
  id: number;
  descripcion: string;
  valorCadena: string | null;
  valorNumerico: number | null;
  tipoDatoInterfaz: 'textarea' | 'bool' | 'number';
}

@Component({
  selector: 'app-parametros-generales',
  imports: [CommonModule, SharedModule, FormsModule],
  templateUrl: './parametros-generales.component.html',
  styleUrls: ['./parametros-generales.component.scss']
})
export class ParametrosGeneralesComponent implements OnInit {
  @ViewChild('loadingModal') loadingModalTemplate!: TemplateRef<any>;
  
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);
  
  parametros: ParametroSistema[] = [];
  isLoading = false;
  isLoadingData = false;
  successMessage = '';
  errorMessage = '';
  editingId: number | null = null;
  editedValues: { [key: number]: any } = {};
  private loadingModalRef: NgbModalRef | null = null;

  ngOnInit() {
    this.loadParametros();
  }

  loadParametros() {
    this.isLoadingData = true;
    this.errorMessage = '';
    
    if (!this.authService.isAuthenticated()) {
      this.isLoadingData = false;
      this.errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    const url = `${environment.apiUrl}/api/parametros-sistema`;
    
    this.http.get<ParametroSistema[]>(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).subscribe({
      next: (response) => {
        this.isLoadingData = false;
        this.parametros = response;
        // Inicializar valores editados con los valores actuales
        response.forEach(param => {
          this.editedValues[param.id] = param.tipoDatoInterfaz === 'bool' 
            ? (param.valorNumerico === 1) 
            : (param.valorCadena !== null ? param.valorCadena : param.valorNumerico);
        });
      },
      error: (error) => {
        this.isLoadingData = false;
        
        if (error.status === 401 || error.status === 403) {
          this.errorMessage = 'No tienes permisos para acceder a esta información.';
        } else if (error.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al cargar los parámetros del sistema. Por favor, intenta nuevamente.';
        }
        
        console.error('Error al cargar parámetros:', error);
      }
    });
  }

  startEdit(id: number) {
    this.editingId = id;
  }

  cancelEdit(id: number) {
    // Restaurar valor original
    const param = this.parametros.find(p => p.id === id);
    if (param) {
      this.editedValues[id] = param.tipoDatoInterfaz === 'bool' 
        ? (param.valorNumerico === 1) 
        : (param.valorCadena !== null ? param.valorCadena : param.valorNumerico);
    }
    this.editingId = null;
  }

  saveParametro(parametro: ParametroSistema) {
    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';
    
    // Abrir modal de carga
    this.openLoadingModal();
    
    if (!this.authService.isAuthenticated()) {
      this.isLoading = false;
      this.closeLoadingModal();
      this.errorMessage = 'No hay sesión activa. Por favor, inicia sesión nuevamente.';
      return;
    }

    const editedValue = this.editedValues[parametro.id];
    const body: any = {
      descripcion: parametro.descripcion,
      tipoDatoInterfaz: parametro.tipoDatoInterfaz
    };

    // Preparar el body según el tipo de dato
    if (parametro.tipoDatoInterfaz === 'bool') {
      body.valorNumerico = editedValue ? 1 : 0;
      body.valorCadena = null;
    } else if (parametro.tipoDatoInterfaz === 'number') {
      body.valorNumerico = editedValue !== null && editedValue !== '' ? Number(editedValue) : null;
      body.valorCadena = null;
    } else if (parametro.tipoDatoInterfaz === 'textarea') {
      body.valorCadena = editedValue || null;
      body.valorNumerico = null;
    }

    const url = `${environment.apiUrl}/api/parametros-sistema/${parametro.id}`;
    
    console.log('Actualizando parámetro:', url, body);
    
    this.http.put<any>(url, body, {
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true
    }).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.closeLoadingModal();
        this.editingId = null;
        
        // Actualizar el parámetro en la lista
        const index = this.parametros.findIndex(p => p.id === parametro.id);
        if (index !== -1) {
          this.parametros[index] = { ...this.parametros[index], ...body };
        }
        
        this.successMessage = 'Parámetro actualizado exitosamente';
        
        // Auto-cerrar el mensaje después de 5 segundos
        setTimeout(() => {
          this.successMessage = '';
        }, 5000);
      },
      error: (error) => {
        this.isLoading = false;
        this.closeLoadingModal();
        
        if (error.status === 401 || error.status === 403) {
          this.errorMessage = 'No tienes permisos para actualizar este parámetro.';
        } else if (error.status === 400) {
          this.errorMessage = error.error?.message || 'Error al actualizar el parámetro. Verifica los datos ingresados.';
        } else if (error.status === 404) {
          this.errorMessage = 'Parámetro no encontrado.';
        } else if (error.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al actualizar el parámetro. Por favor, intenta nuevamente.';
        }
        
        console.error('Error al actualizar parámetro:', error);
      }
    });
  }

  openLoadingModal() {
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

  getDisplayValue(parametro: ParametroSistema): string {
    if (parametro.tipoDatoInterfaz === 'bool') {
      return parametro.valorNumerico === 1 ? 'Sí' : 'No';
    } else if (parametro.tipoDatoInterfaz === 'number') {
      return parametro.valorNumerico !== null ? parametro.valorNumerico.toString() : '';
    } else {
      return parametro.valorCadena || '';
    }
  }

  isEditing(id: number): boolean {
    return this.editingId === id;
  }

  trackByFn(index: number, item: ParametroSistema): number {
    return item.id;
  }
}

