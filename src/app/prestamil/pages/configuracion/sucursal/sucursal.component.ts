// angular import
import { Component, OnInit, AfterViewInit, inject, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-sucursal',
  imports: [CommonModule, SharedModule, ReactiveFormsModule],
  templateUrl: './sucursal.component.html',
  styleUrls: ['./sucursal.component.scss']
})
export class SucursalComponent implements OnInit, AfterViewInit {
  @ViewChild('loadingModal') loadingModalTemplate!: TemplateRef<any>;
  
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private modalService = inject(NgbModal);
  
  sucursalForm!: FormGroup;
  isLoading = false;
  isLoadingData = false;
  successMessage = '';
  errorMessage = '';
  estados: any[] = [];
  empresas: any[] = [];
  private loadingModalRef: NgbModalRef | null = null;

  constructor(private fb: FormBuilder) {}

  ngOnInit() {
    this.sucursalForm = this.fb.group({
      id: [{ value: null, disabled: true }],
      numeroSucursal: ['', [Validators.required]],
      nombre: ['', [Validators.required]],
      idEmpresa: ['', [Validators.required]],
      idRazonSocial: [{ value: '', disabled: true }],
      nombreEmpresa: [{ value: '', disabled: true }],
      razonSocial: [''],
      calle: ['', [Validators.required]],
      noExterior: ['', [Validators.required]],
      noInterior: [''],
      colonia: ['', [Validators.required]],
      municipio: ['', [Validators.required]],
      cp: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      estado: ['', [Validators.required]],
      pais: ['', [Validators.required]],
      lada: ['', [Validators.pattern(/^\d+$/)]],
      telefono: ['', [Validators.pattern(/^\d+$/)]],
      fechaApertura: ['', [Validators.required]],
      rfc: ['', [Validators.required, Validators.pattern(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i)]],
      fechaRegistroProfeco: [''],
      fechaContratoProfeco: ['']
    });

    // Cargar empresas y estados
    this.loadEmpresas();
    this.loadEstados();
    // loadSucursalData se llamará desde loadEmpresas cuando las empresas estén cargadas

    // Listener para actualizar campos relacionados cuando se selecciona una empresa
    this.sucursalForm.get('idEmpresa')?.valueChanges.subscribe((empresaId) => {
      console.log('Empresa seleccionada ID:', empresaId, 'Tipo:', typeof empresaId);
      console.log('Empresas disponibles:', this.empresas);
      
      if (empresaId) {
        // Convertir a número para comparación (el select devuelve string)
        const empresaIdNum = Number(empresaId);
        const empresaSeleccionada = this.empresas.find(emp => emp.id === empresaIdNum || emp.id === empresaId);
        
        console.log('Empresa encontrada:', empresaSeleccionada);
        
        if (empresaSeleccionada) {
          // Habilitar temporalmente los campos deshabilitados para poder actualizarlos
          const idRazonSocialControl = this.sucursalForm.get('idRazonSocial');
          const nombreEmpresaControl = this.sucursalForm.get('nombreEmpresa');
          
          if (idRazonSocialControl?.disabled) idRazonSocialControl.enable({ emitEvent: false });
          if (nombreEmpresaControl?.disabled) nombreEmpresaControl.enable({ emitEvent: false });
          
          // Actualizar razonSocial directamente (no está disabled)
          this.sucursalForm.patchValue({
            idRazonSocial: empresaSeleccionada.id,
            nombreEmpresa: empresaSeleccionada.nombre,
            razonSocial: empresaSeleccionada.razonSocial || ''
          }, { emitEvent: false });
          
          console.log('Valores actualizados:', {
            idRazonSocial: empresaSeleccionada.id,
            nombreEmpresa: empresaSeleccionada.nombre,
            razonSocial: empresaSeleccionada.razonSocial
          });
          
          // Deshabilitar nuevamente los campos
          if (idRazonSocialControl) idRazonSocialControl.disable({ emitEvent: false });
          if (nombreEmpresaControl) nombreEmpresaControl.disable({ emitEvent: false });
        } else {
          // Si no hay empresa seleccionada, limpiar los campos
          const idRazonSocialControl = this.sucursalForm.get('idRazonSocial');
          const nombreEmpresaControl = this.sucursalForm.get('nombreEmpresa');
          
          if (idRazonSocialControl?.disabled) idRazonSocialControl.enable({ emitEvent: false });
          if (nombreEmpresaControl?.disabled) nombreEmpresaControl.enable({ emitEvent: false });
          
          this.sucursalForm.patchValue({
            idRazonSocial: '',
            nombreEmpresa: '',
            razonSocial: ''
          }, { emitEvent: false });
          
          if (idRazonSocialControl) idRazonSocialControl.disable({ emitEvent: false });
          if (nombreEmpresaControl) nombreEmpresaControl.disable({ emitEvent: false });
        }
      } else {
        // Limpiar campos si no hay selección
        const idRazonSocialControl = this.sucursalForm.get('idRazonSocial');
        const nombreEmpresaControl = this.sucursalForm.get('nombreEmpresa');
        
        if (idRazonSocialControl?.disabled) idRazonSocialControl.enable({ emitEvent: false });
        if (nombreEmpresaControl?.disabled) nombreEmpresaControl.enable({ emitEvent: false });
        
        this.sucursalForm.patchValue({
          idRazonSocial: '',
          nombreEmpresa: '',
          razonSocial: ''
        }, { emitEvent: false });
        
        if (idRazonSocialControl) idRazonSocialControl.disable({ emitEvent: false });
        if (nombreEmpresaControl) nombreEmpresaControl.disable({ emitEvent: false });
      }
    });
  }

  ngAfterViewInit() {
    // El ViewChild ahora está disponible
    console.log('ngAfterViewInit - Template disponible:', !!this.loadingModalTemplate);
  }

  loadEmpresas() {
    const token = this.authService.getToken();
    if (!token) {
      console.error('No hay token de autenticación para cargar empresas');
      return;
    }

    const url = `${environment.apiUrl}/api/empresas`;
    
    this.http.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        // Si la respuesta es un array, usarlo directamente
        if (Array.isArray(response)) {
          this.empresas = response;
        } else if (response && Array.isArray(response.data)) {
          this.empresas = response.data;
        } else if (response && Array.isArray(response.empresas)) {
          this.empresas = response.empresas;
        } else {
          console.warn('Formato de respuesta de empresas no reconocido:', response);
          this.empresas = [];
        }
        
        // Una vez cargadas las empresas, cargar los datos de la sucursal
        // para poder preseleccionar la empresa correcta
        // Esperar un momento para asegurar que el ViewChild esté disponible
        setTimeout(() => {
          this.loadSucursalData();
        }, 200);
      },
      error: (error) => {
        console.error('Error al cargar empresas:', error);
        this.empresas = [];
        // Intentar cargar datos de sucursal de todas formas
        this.loadSucursalData();
      }
    });
  }

  loadEstados() {
    const token = this.authService.getToken();
    if (!token) {
      console.error('No hay token de autenticación para cargar estados');
      return;
    }

    const url = `${environment.apiUrl}/api/master-data/estados`;
    
    this.http.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        // Si la respuesta es un array, usarlo directamente
        // Si es un objeto con una propiedad que contiene el array, extraerlo
        if (Array.isArray(response)) {
          this.estados = response;
        } else if (response && Array.isArray(response.data)) {
          this.estados = response.data;
        } else if (response && Array.isArray(response.estados)) {
          this.estados = response.estados;
        } else {
          console.warn('Formato de respuesta de estados no reconocido:', response);
          this.estados = [];
        }
      },
      error: (error) => {
        console.error('Error al cargar estados:', error);
        this.estados = [];
      }
    });
  }

  loadSucursalData() {
    this.isLoadingData = true;
    this.errorMessage = '';
    
    // Abrir modal de carga
    this.openLoadingModal();
    
    const token = this.authService.getToken();
    if (!token) {
      this.isLoadingData = false;
      this.closeLoadingModal();
      this.errorMessage = 'No hay token de autenticación. Por favor, inicia sesión nuevamente.';
      return;
    }

    const url = `${environment.apiUrl}/api/sucursales`;
    
    this.http.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }).subscribe({
      next: (response) => {
        // Si la respuesta es un array, tomar el primer elemento
        const sucursalData = Array.isArray(response) ? response[0] : response;
        
        if (sucursalData) {
          // Formatear fechas para los inputs de tipo date/datetime-local
          const formatDateForInput = (dateString: string | null): string => {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toISOString().split('T')[0];
          };

          const formatDateTimeForInput = (dateString: string | null): string => {
            if (!dateString) return '';
            const date = new Date(dateString);
            // Formato: YYYY-MM-DDTHH:mm
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}`;
          };

          // Llenar el formulario con los datos recibidos
          // Establecer idEmpresa basado en idRazonSocial si existe
          const idRazonSocial = sucursalData.idRazonSocial;
          // Buscar la empresa por idRazonSocial en la lista de empresas cargadas
          // Comparar tanto como número como string para asegurar coincidencia
          const empresaEncontrada = this.empresas.find(emp => 
            emp.id === idRazonSocial || 
            emp.id === Number(idRazonSocial) || 
            Number(emp.id) === idRazonSocial
          );
          
          // Si encontramos la empresa, usar sus datos; si no, usar los datos del servidor
          const empresaId = empresaEncontrada ? empresaEncontrada.id : (idRazonSocial || null);
          const razonSocialValue = empresaEncontrada ? empresaEncontrada.razonSocial : (sucursalData.razonSocial || '');
          const nombreEmpresaValue = empresaEncontrada ? empresaEncontrada.nombre : (sucursalData.nombreEmpresa || '');
          
          // Habilitar temporalmente los campos deshabilitados para poder actualizarlos
          const idRazonSocialControl = this.sucursalForm.get('idRazonSocial');
          const nombreEmpresaControl = this.sucursalForm.get('nombreEmpresa');
          
          if (idRazonSocialControl?.disabled) idRazonSocialControl.enable({ emitEvent: false });
          if (nombreEmpresaControl?.disabled) nombreEmpresaControl.enable({ emitEvent: false });
          
          console.log('Preseleccionando empresa:', {
            idRazonSocial,
            empresaEncontrada,
            empresaId,
            razonSocialValue
          });
          
          this.sucursalForm.patchValue({
            id: sucursalData.id || null,
            numeroSucursal: sucursalData.numeroSucursal || '',
            nombre: sucursalData.nombre || '',
            idEmpresa: empresaId,
            idRazonSocial: sucursalData.idRazonSocial || '',
            nombreEmpresa: nombreEmpresaValue,
            razonSocial: razonSocialValue,
            calle: sucursalData.calle || '',
            noExterior: sucursalData.noExterior || '',
            noInterior: sucursalData.noInterior || '',
            colonia: sucursalData.colonia || '',
            municipio: sucursalData.municipio || '',
            cp: sucursalData.cp || '',
            estado: sucursalData.estado || '',
            pais: sucursalData.pais || '',
            lada: sucursalData.lada || '',
            telefono: sucursalData.telefono || '',
            fechaApertura: formatDateForInput(sucursalData.fechaApertura),
            rfc: sucursalData.rfc || '',
            fechaRegistroProfeco: formatDateTimeForInput(sucursalData.fechaRegistroProfeco),
            fechaContratoProfeco: formatDateTimeForInput(sucursalData.fechaContratoProfeco)
          });
          
          // Deshabilitar nuevamente los campos después de actualizarlos
          if (idRazonSocialControl) idRazonSocialControl.disable({ emitEvent: false });
          if (nombreEmpresaControl) nombreEmpresaControl.disable({ emitEvent: false });
        }
        
        // Cerrar el modal después de procesar todos los datos
        this.isLoadingData = false;
        setTimeout(() => {
          this.closeLoadingModal();
        }, 100);
      },
      error: (error) => {
        this.isLoadingData = false;
        this.closeLoadingModal();
        
        if (error.status === 401 || error.status === 403) {
          this.errorMessage = 'No tienes permisos para acceder a esta información.';
        } else if (error.status === 0) {
          this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
        } else if (error.error && error.error.message) {
          this.errorMessage = error.error.message;
        } else {
          this.errorMessage = 'Error al cargar los datos de la sucursal. Por favor, intenta nuevamente.';
        }
        
        console.error('Error al cargar datos de sucursal:', error);
      }
    });
  }

  openLoadingModal() {
    console.log('Intentando abrir modal. Template disponible:', !!this.loadingModalTemplate);
    console.log('Modal ref actual:', this.loadingModalRef);
    
    // Usar setTimeout para asegurar que el ViewChild esté disponible
    setTimeout(() => {
      if (this.loadingModalTemplate && !this.loadingModalRef) {
        try {
          this.loadingModalRef = this.modalService.open(this.loadingModalTemplate, {
            backdrop: 'static',
            keyboard: false,
            centered: true,
            size: 'sm',
            windowClass: 'loading-modal'
          });
          console.log('Modal de carga abierto exitosamente');
        } catch (error) {
          console.error('Error al abrir modal:', error);
        }
      } else {
        console.warn('Template del modal no disponible o modal ya abierto', {
          template: !!this.loadingModalTemplate,
          ref: !!this.loadingModalRef
        });
      }
    }, 100);
  }

  closeLoadingModal() {
    console.log('Cerrando modal. Modal ref:', !!this.loadingModalRef);
    if (this.loadingModalRef) {
      try {
        this.loadingModalRef.close();
        this.loadingModalRef = null;
        console.log('Modal cerrado exitosamente');
      } catch (error) {
        console.error('Error al cerrar modal:', error);
        this.loadingModalRef = null;
      }
    } else {
      console.warn('No hay referencia del modal para cerrar');
    }
  }

  onSubmit() {
    if (this.sucursalForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';
      
      const token = this.authService.getToken();
      if (!token) {
        this.isLoading = false;
        this.errorMessage = 'No hay token de autenticación. Por favor, inicia sesión nuevamente.';
        return;
      }

      const formValue = this.sucursalForm.getRawValue();
      const sucursalId = formValue.id;
      
      if (!sucursalId) {
        this.isLoading = false;
        this.errorMessage = 'No se pudo obtener el ID de la sucursal.';
        return;
      }

      // Construir el body con los datos necesarios para el PUT
      // Excluir campos que no se envían al servidor (idEmpresa, nombreEmpresa)
      const body = {
        numeroSucursal: Number(formValue.numeroSucursal) || null,
        nombre: formValue.nombre || '',
        idRazonSocial: Number(formValue.idRazonSocial) || null,
        calle: formValue.calle || '',
        noExterior: formValue.noExterior || '',
        noInterior: formValue.noInterior || null,
        colonia: formValue.colonia || '',
        municipio: formValue.municipio || '',
        cp: formValue.cp || '',
        estado: formValue.estado || '',
        pais: formValue.pais || '',
        lada: formValue.lada ? Number(formValue.lada) : null,
        telefono: formValue.telefono || null,
        fechaApertura: formValue.fechaApertura || null,
        rfc: formValue.rfc || '',
        fechaRegistroProfeco: formValue.fechaRegistroProfeco || null,
        fechaContratoProfeco: formValue.fechaContratoProfeco || null
      };

      const url = `${environment.apiUrl}/api/sucursales/${sucursalId}`;
      
      console.log('Actualizando sucursal:', url, body);
      
      this.http.put<any>(url, body, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = 'Sucursal actualizada exitosamente';
          console.log('Sucursal actualizada:', response);
          
          // Auto-cerrar la notificación después de 5 segundos
          setTimeout(() => {
            this.successMessage = '';
          }, 5000);
        },
        error: (error) => {
          this.isLoading = false;
          
          // Manejar diferentes tipos de errores
          if (error.status === 401 || error.status === 403) {
            this.errorMessage = 'No tienes permisos para actualizar la sucursal.';
          } else if (error.status === 400) {
            this.errorMessage = error.error?.message || 'Error al actualizar la sucursal. Verifica los datos ingresados.';
          } else if (error.status === 404) {
            this.errorMessage = 'Sucursal no encontrada.';
          } else if (error.status === 0) {
            this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
          } else if (error.error && error.error.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Error al actualizar la sucursal. Por favor, intenta nuevamente.';
          }
          
          console.error('Error al actualizar sucursal:', error);
        }
      });
    } else {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.sucursalForm.controls).forEach(key => {
        this.sucursalForm.get(key)?.markAsTouched();
      });
    }
  }

  // Getters para facilitar el acceso a los controles del formulario
  get numeroSucursal() { return this.sucursalForm.get('numeroSucursal'); }
  get nombre() { return this.sucursalForm.get('nombre'); }
  get idEmpresa() { return this.sucursalForm.get('idEmpresa'); }
  get idRazonSocial() { return this.sucursalForm.get('idRazonSocial'); }
  get calle() { return this.sucursalForm.get('calle'); }
  get noExterior() { return this.sucursalForm.get('noExterior'); }
  get colonia() { return this.sucursalForm.get('colonia'); }
  get municipio() { return this.sucursalForm.get('municipio'); }
  get cp() { return this.sucursalForm.get('cp'); }
  get estado() { return this.sucursalForm.get('estado'); }
  get pais() { return this.sucursalForm.get('pais'); }
  get lada() { return this.sucursalForm.get('lada'); }
  get telefono() { return this.sucursalForm.get('telefono'); }
  get fechaApertura() { return this.sucursalForm.get('fechaApertura'); }
  get rfc() { return this.sucursalForm.get('rfc'); }
}

