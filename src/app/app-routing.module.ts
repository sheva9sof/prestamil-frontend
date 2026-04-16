import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// project import
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { authGuard } from './prestamil/core/guards/auth.guard';
import { loginGuard } from './prestamil/core/guards/login.guard';

const routes: Routes = [
  {
    path: 'login',
    component: GuestComponent,
    canActivate: [loginGuard], // Evitar acceso si ya está autenticado
    children: [
      {
        path: '',
        loadComponent: () => import('./prestamil/pages/authentication/login/login.component').then((c) => c.AuthSigninComponent)
      }
    ]
  },
  {
    path: '',
    component: AdminComponent,
    canActivate: [authGuard], // Proteger todas las rutas hijas
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./prestamil/dashboard/dashboard.component').then((c) => c.DashboardComponent)
      },
      {
        path: 'sse-status',
        loadComponent: () => import('./prestamil/dashboard/sse-status.component').then((c) => c.SseStatusComponent)
      },
      {
        path: 'usuarios',
        loadComponent: () => import('./prestamil/pages/usuarios/usuarios.component').then((c) => c.UsuariosComponent)
      },
      {
        path: 'turnos',
        loadComponent: () => import('./prestamil/pages/turnos/turnos.component').then((c) => c.TurnosComponent)
      },
      {
        path: 'hardware',
        loadComponent: () => import('./prestamil/pages/hardware/hardware.component').then((c) => c.HardwareComponent)
      },
      {
        path: 'catalogos',
        children: [
          {
            path: 'prendas',
            loadComponent: () => import('./prestamil/pages/catalogos/prendas/prendas.component').then((c) => c.PrendasComponent)
          }
        ]
      },
      {
        path: 'configuracion',
        children: [
          {
            path: 'sucursal',
            loadComponent: () => import('./prestamil/pages/configuracion/sucursal/sucursal.component').then((c) => c.SucursalComponent)
          },
          {
            path: 'empresas',
            loadComponent: () => import('./prestamil/pages/catalogos/empresas/empresas.component').then((c) => c.EmpresasComponent)
          },
          {
            path: 'parametros-prestamo',
            loadComponent: () => import('./prestamil/pages/configuracion/parametros-prestamo/parametros-prestamo.component').then((c) => c.ParametrosPrestamoComponent)
          },
          {
            path: 'parametros-generales',
            loadComponent: () => import('./prestamil/pages/configuracion/parametros-generales/parametros-generales.component').then((c) => c.ParametrosGeneralesComponent)
          },
          {
            path: 'plazos-periodos',
            loadComponent: () => import('./prestamil/pages/configuracion/plazos-periodos/plazos-periodos.component').then((c) => c.PlazosPeriodosComponent)
          },
          {
            path: 'actualizar-password',
            loadComponent: () => import('./prestamil/pages/configuracion/actualizar-password/actualizar-password.component').then((c) => c.ActualizarPasswordComponent)
          }
        ]
      },
      {
        path: '**',
        redirectTo: 'dashboard'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
