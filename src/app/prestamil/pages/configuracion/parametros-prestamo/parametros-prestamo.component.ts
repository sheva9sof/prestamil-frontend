// angular import
import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { PlazoService } from '../../../core/services/plazo.service';
import { PlazoResponse, PlazoParametroResponse } from '../../../core/models/plazo.model';

@Component({
  selector: 'app-parametros-prestamo',
  standalone: true,
  imports: [CommonModule, SharedModule],
  templateUrl: './parametros-prestamo.component.html',
  styleUrls: ['./parametros-prestamo.component.scss']
})
export class ParametrosPrestamoComponent implements OnInit {
  private readonly plazoService = inject(PlazoService);

  plazos: PlazoResponse[] = [];
  parametrosPorPlazo: { plazo: PlazoResponse; parametros: PlazoParametroResponse[] }[] = [];
  sucursalId = 1;
  isLoading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.cargarTodo();
  }

  /**
   * Carga todos los plazos activos y sus parámetros en paralelo usando forkJoin.
   */
  cargarTodo(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.plazoService.getAll().subscribe({
      next: (plazos) => {
        this.plazos = plazos.filter(p => p.activo);
        if (this.plazos.length === 0) {
          this.parametrosPorPlazo = [];
          this.isLoading = false;
          return;
        }
        const calls = this.plazos.map(p =>
          this.plazoService.getParametrosBySucursal(p.id, this.sucursalId)
        );
        forkJoin(calls).subscribe({
          next: (results) => {
            this.parametrosPorPlazo = this.plazos.map((p, i) => ({
              plazo: p,
              parametros: results[i]
            }));
            this.isLoading = false;
          },
          error: (err) => {
            this.errorMessage = 'Error al cargar parámetros: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
            this.isLoading = false;
          }
        });
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar plazos: ' + (err?.error?.message ?? err.message ?? 'Error desconocido');
        this.isLoading = false;
      }
    });
  }

  trackByPlazo(_index: number, item: { plazo: PlazoResponse; parametros: PlazoParametroResponse[] }): number {
    return item.plazo.id;
  }

  trackByParam(_index: number, item: PlazoParametroResponse): number {
    return item.tipoPrendaId;
  }
}
