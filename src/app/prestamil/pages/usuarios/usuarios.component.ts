// angular import
import { Component, OnInit, AfterViewInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { NgbModal, NgbModalRef } from '@ng-bootstrap/ng-bootstrap';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { UsuarioService } from '../../core/services/usuario.service';
import { Usuario } from '../../core/models/usuario.model';
import { RolService, Rol } from '../../core/services/rol.service';

@Component({
  selector: 'app-usuarios',
  imports: [CommonModule, SharedModule, ReactiveFormsModule],
  templateUrl: './usuarios.component.html',
  styleUrls: ['./usuarios.component.scss']
})
export class UsuariosComponent implements OnInit, AfterViewInit {
  usuarios: Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];
  loading = false;
  roles: Rol[] = [];
  errorMessage: string | null = null;

  // Filtros
  filtroRol: number | null = null;
  filtroEstatus: boolean | null = null;

  form: FormGroup;
  editId: number | null = null;

  @ViewChild('usuarioModal') usuarioModal!: TemplateRef<any>;
  @ViewChild('loadingModal') loadingModalTemplate!: TemplateRef<any>;
  private loadingModalRef: NgbModalRef | null = null;

  constructor(private usuarioService: UsuarioService, private modalService: NgbModal, private fb: FormBuilder, private rolService: RolService) {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellidos: [''],
      nombreUsuario: ['', [Validators.required, Validators.minLength(4)]],
      // El campo email no tendrá validaciones en el formulario de Usuarios
      email: [''],
      // por defecto password no es obligatorio; aplicamos minlength solo si tiene valor
      password: ['', [this.optionalMinLength(5)]],
      idRol: [null, Validators.required],
      estatus: [true]
    });
  }

  // Validador opcional: aplica minlength solo cuando hay valor
  optionalMinLength(min: number) {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = control.value as string | null | undefined;
      if (val === null || val === undefined || val === '') return null;
      return val.length >= min ? null : { minlength: { requiredLength: min, actualLength: val.length } };
    };
  }

  ngOnInit(): void {
    // La carga inicial se hará en ngAfterViewInit para asegurar que el ViewChild esté disponible
  }

  ngAfterViewInit(): void {
    // El ViewChild ahora está disponible, cargar datos
    setTimeout(() => {
      this.loadInitialData();
    }, 100);
  }

  loadInitialData(): void {
    // Mostrar modal de carga
    if (this.loadingModalTemplate) {
      this.loadingModalRef = this.modalService.open(this.loadingModalTemplate, {
        backdrop: 'static',
        keyboard: false,
        centered: true
      });
    }

    // Cargar roles primero y luego usuarios para poder mapear nombres de rol localmente
    this.rolService.findAll().subscribe({
      next: (r) => {
        this.roles = r;
        this.loadUsuarios();
      },
      error: () => {
        this.roles = [];
        this.loadUsuarios();
      }
    });
  }

  loadUsuarios() {
    this.loading = true;
    this.usuarioService.findAll().subscribe({
      next: (data) => {
        this.usuarios = data;
          // Mapear nombre de rol desde la lista de roles si no viene en la respuesta
        this.usuarios.forEach(u => {
          const anyU = u as any;
          // intentar obtener un id de rol de diferentes formatos que pueda devolver el backend
          const candidateId = u.idRol ?? anyU.rol?.id ?? anyU.rolId ?? anyU.idRol ?? null;
          const idNum = candidateId != null ? Number(candidateId) : null;
          if (!u.rolNombre && idNum != null && !isNaN(idNum)) {
            const found = this.roles.find(r => r.id === idNum);
            if (found) u.rolNombre = found.nombre;
          }
        });
        this.aplicarFiltros();
        this.loading = false;
        
        // Cerrar modal de carga
        if (this.loadingModalRef) {
          this.loadingModalRef.close();
          this.loadingModalRef = null;
        }
      },
      error: () => {
        this.loading = false;
        
        // Cerrar modal de carga en caso de error
        if (this.loadingModalRef) {
          this.loadingModalRef.close();
          this.loadingModalRef = null;
        }
      }
    });
  }

  aplicarFiltros() {
    this.usuariosFiltrados = this.usuarios.filter(u => {
      // Filtro por rol
      if (this.filtroRol !== null && u.idRol !== this.filtroRol) {
        return false;
      }
      // Filtro por estatus
      if (this.filtroEstatus !== null && u.estatus !== this.filtroEstatus) {
        return false;
      }
      return true;
    });
  }

  limpiarFiltros() {
    this.filtroRol = null;
    this.filtroEstatus = null;
    this.aplicarFiltros();
  }

  openNew() {
    this.editId = null;
    this.errorMessage = null;
    // Hacer contraseña obligatoria al crear
    const pwdCtrl = this.form.get('password');
    if (pwdCtrl) {
      pwdCtrl.setValidators([Validators.required, this.optionalMinLength(5)]);
      pwdCtrl.updateValueAndValidity();
    }
    // Por defecto no seleccionar ningún rol (dejar la opción "Seleccione un rol" activa)
    this.form.reset({ estatus: true, idRol: null });
    this.modalService.open(this.usuarioModal, { size: 'lg' });
  }

  openEdit(u: Usuario) {
    this.editId = u.id ?? null;
    this.errorMessage = null;
    // Al editar, la contraseña NO es obligatoria (dejar en blanco mantiene la actual)
    const pwdCtrl = this.form.get('password');
    if (pwdCtrl) {
      pwdCtrl.setValidators([this.optionalMinLength(5)]);
      pwdCtrl.updateValueAndValidity();
    }

    this.form.patchValue({
      nombre: u.nombre,
      apellidos: u.apellidos || '',
      nombreUsuario: u.nombreUsuario,
      estatus: u.estatus ?? true,
      password: '',
      idRol: u.idRol ?? null
    });
    this.modalService.open(this.usuarioModal, { size: 'lg' });
  }

  save(modalRef: any) {
    if (this.form.invalid) {
      return;
    }

    this.errorMessage = null;
    const formValue = this.form.value;
    const payload: any = {
      ...formValue,
    };
  
    if (formValue.idRol) {
      payload.rol = { id: formValue.idRol };
      delete payload.idRol;
    } 
    else if (formValue.rol && typeof formValue.rol !== 'object') {
      payload.rol = { id: formValue.rol };
    }
  
    if (this.editId) {
      this.usuarioService.update(this.editId, payload).subscribe({
        next: () => {
          modalRef.close();
          this.loadUsuarios();
        },
        error: (err) => {
          this.handleSaveError(err);
        }
      });
    } else {
      this.usuarioService.create(payload).subscribe({
        next: () => {
          modalRef.close();
          this.loadUsuarios();
        },
        error: (err) => {
          this.handleSaveError(err);
        }
      });
    }
  }

  handleSaveError(err: any) {
    console.error('Error al guardar usuario:', err);
    
    // Detectar error de nombreUsuario duplicado
    if (err?.error?.message && 
        (err.error.message.includes('Duplicate entry') && err.error.message.includes('usuarios_unique') ||
         err.error.message.includes('nombreUsuario') && err.error.message.includes('unique'))) {
      this.errorMessage = 'El nombre de usuario ya existe. Por favor, elija otro nombre de usuario.';
    } else if (err?.status === 500) {
      this.errorMessage = 'Error al guardar el usuario. Por favor, intente nuevamente.';
    } else {
      this.errorMessage = err?.error?.message || 'Error desconocido al guardar el usuario.';
    }
  }

  confirmDelete(u: Usuario) {
    if (!u.id) return;
    if (!confirm(`Eliminar usuario "${u.nombreUsuario}" ?`)) return;
    this.usuarioService.delete(u.id).subscribe({ next: () => this.loadUsuarios() });
  }

  rolDisplay(u: Usuario): string {
    // Prefer rolNombre, luego intentar leer objeto rol, luego idRol
    const anyU = u as any;
    if (u.rolNombre) return u.rolNombre;
    if (anyU.rol && anyU.rol.nombre) return anyU.rol.nombre;
    if (u.idRol) return String(u.idRol);
    return '-';
  }
}

