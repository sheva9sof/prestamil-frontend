// angular import
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors } from '@angular/forms';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-actualizar-password',
  imports: [CommonModule, SharedModule, ReactiveFormsModule, RouterModule],
  templateUrl: './actualizar-password.component.html',
  styleUrls: ['./actualizar-password.component.scss']
})
export class ActualizarPasswordComponent implements OnInit {
  private authService = inject(AuthService);
  
  passwordForm!: FormGroup;
  isLoading = false;
  successMessage = '';
  errorMessage = '';
  showNewPassword = false;
  showConfirmPassword = false;

  constructor(private fb: FormBuilder) {}

  toggleNewPasswordVisibility() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  ngOnInit() {
    this.passwordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(5)]],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });

    // Actualizar validación cuando cambie la nueva contraseña
    this.passwordForm.get('newPassword')?.valueChanges.subscribe(() => {
      this.passwordForm.get('confirmPassword')?.updateValueAndValidity();
    });
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;
    const confirmPasswordControl = control.get('confirmPassword');
    
    if (!newPassword || !confirmPassword) {
      return null;
    }
    
    if (newPassword !== confirmPassword) {
      const currentErrors = confirmPasswordControl?.errors || {};
      confirmPasswordControl?.setErrors({ ...currentErrors, passwordMismatch: true });
      return { passwordMismatch: true };
    } else {
      if (confirmPasswordControl?.hasError('passwordMismatch')) {
        const { passwordMismatch, ...otherErrors } = confirmPasswordControl.errors || {};
        if (Object.keys(otherErrors).length > 0) {
          confirmPasswordControl.setErrors(otherErrors);
        } else {
          confirmPasswordControl.setErrors(null);
        }
      }
    }
    return null;
  }

  onSubmit() {
    if (this.passwordForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';
      
      const { currentPassword, newPassword } = this.passwordForm.value;
      
      // Obtener el ID del usuario desde el token
      const userId = this.authService.getUserId();
      
      if (!userId) {
        this.isLoading = false;
        this.errorMessage = 'No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.';
        return;
      }
      
      console.log('Cambiando contraseña para usuario ID:', userId);
      
      // Llamar al servicio para cambiar la contraseña
      this.authService.cambiarPassword(userId, currentPassword, newPassword).subscribe({
        next: (response) => {
          this.isLoading = false;
          this.successMessage = 'Contraseña actualizada exitosamente';
          this.passwordForm.reset();
          this.showNewPassword = false;
          this.showConfirmPassword = false;
        },
        error: (error) => {
          this.isLoading = false;
          
          // Manejar diferentes tipos de errores
          if (error.status === 401 || error.status === 403) {
            this.errorMessage = 'La contraseña actual es incorrecta';
          } else if (error.status === 400) {
            this.errorMessage = error.error?.message || 'Error al actualizar la contraseña. Verifica los datos ingresados.';
          } else if (error.status === 0) {
            this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
          } else if (error.error && error.error.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Error al actualizar la contraseña. Por favor, intenta nuevamente.';
          }
          
          console.error('Error al cambiar contraseña:', error);
        }
      });
    } else {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.passwordForm.controls).forEach(key => {
        this.passwordForm.get(key)?.markAsTouched();
      });
    }
  }

  get currentPassword() {
    return this.passwordForm.get('currentPassword');
  }

  get newPassword() {
    return this.passwordForm.get('newPassword');
  }

  get confirmPassword() {
    return this.passwordForm.get('confirmPassword');
  }

  get fullName(): string {
    const user = this.authService.getUser();
    if (user) {
      return `${user.nombre || ''} ${user.apellidos || ''}`.trim();
    }
    return '';
  }
}

