import { Component, OnInit } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-auth-signin',
  imports: [RouterModule, ReactiveFormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class AuthSigninComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  errorMessage = '';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(5)]],
      password: ['', [Validators.required, Validators.minLength(5)]]
    });
  }

  login() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';
      
      const { username, password } = this.loginForm.value;
      
      // Mapear username a nombreUsuario para el backend
      this.authService.login(username, password).subscribe({
        next: (response) => {
          console.log('Login response:', response);
          
          // Validar que la respuesta tenga los campos necesarios
          if (!response || !response.token || !response.nombreUsuario) {
            this.isLoading = false;
            this.errorMessage = 'Usuario o contraseña incorrectos';
            console.error('Invalid response:', response);
            return;
          }
          
          // Validar que el usuario esté activo
          if (response.estatus === false) {
            this.isLoading = false;
            this.errorMessage = 'Usuario inactivo. Contacta al administrador.';
            return;
          }
          
          // Guardar sesión con la respuesta completa del login
          this.authService.setSession(response);
          console.log('Session saved, isAuthenticated:', this.authService.isAuthenticated());
          
          // Esperar un momento para asegurar que el estado se actualice
          setTimeout(() => {
            this.isLoading = false;
            
            // Obtener URL de retorno o usar dashboard por defecto
            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
            // Normalizar la URL (remover /default si existe)
            const normalizedUrl = returnUrl.replace('/default', '').replace(/\/$/, '') || '/dashboard';
            console.log('Navigating to:', normalizedUrl);
            this.router.navigate([normalizedUrl]).then(
              (success) => {
                console.log('Navigation success:', success);
              },
              (error) => {
                console.error('Navigation error:', error);
                this.errorMessage = 'Error al redirigir. Por favor, intenta nuevamente.';
              }
            );
          }, 100);
        },
        error: (error) => {
          this.isLoading = false;
          
          // Manejar diferentes tipos de errores
          if (error.status === 401 || error.status === 403) {
            this.errorMessage = 'Usuario o contraseña incorrectos';
          } else if (error.status === 0) {
            this.errorMessage = 'No se pudo conectar con el servidor. Verifica tu conexión.';
          } else if (error.error && error.error.message) {
            this.errorMessage = error.error.message;
          } else {
            this.errorMessage = 'Error al iniciar sesión. Por favor, intenta nuevamente.';
          }
          
          console.error('Login error:', error);
        }
      });
    } else {
      // Marcar todos los campos como touched para mostrar errores
      Object.keys(this.loginForm.controls).forEach(key => {
        this.loginForm.get(key)?.markAsTouched();
      });
    }
  }

  get username() {
    return this.loginForm.get('username');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
