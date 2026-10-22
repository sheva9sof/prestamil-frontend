import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { Banco } from 'src/app/prestamil/core/models/banco.model';
import { BancoService } from 'src/app/prestamil/core/services/banco.service';

/**
 * Catálogo de bancos emisores de la ventana de Cobro (RN-24), dentro de Parámetros Generales.
 * Alta, edición del nombre y activar/desactivar; no hay borrado porque los movimientos guardan el banco.
 */
@Component({
  selector: 'app-bancos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bancos.component.html',
  styleUrls: ['./bancos.component.scss']
})
export class BancosComponent implements OnInit {
  private bancoService = inject(BancoService);

  bancos: Banco[] = [];
  isLoadingData = false;
  isSaving = false;
  errorMessage = '';
  successMessage = '';

  nuevoNombre = '';
  editandoId: number | null = null;
  nombreEditado = '';

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoadingData = true;
    this.bancoService.listar().subscribe({
      next: (bancos) => {
        this.bancos = bancos;
        this.isLoadingData = false;
      },
      error: (err) => {
        this.isLoadingData = false;
        this.errorMessage = err?.error?.message ?? 'Error al cargar los bancos.';
      }
    });
  }

  agregar(): void {
    const nombre = this.nuevoNombre.trim();
    if (!nombre || this.isSaving) return;
    this.guardar(this.bancoService.crear({ nombre, activo: true }), `Banco ${nombre} agregado.`, () => {
      this.nuevoNombre = '';
    });
  }

  iniciarEdicion(banco: Banco): void {
    this.editandoId = banco.id;
    this.nombreEditado = banco.nombre;
  }

  cancelarEdicion(): void {
    this.editandoId = null;
    this.nombreEditado = '';
  }

  guardarEdicion(banco: Banco): void {
    const nombre = this.nombreEditado.trim();
    if (!nombre || this.isSaving) return;
    this.guardar(this.bancoService.actualizar(banco.id, { nombre, activo: banco.activo }), 'Banco actualizado.', () =>
      this.cancelarEdicion()
    );
  }

  cambiarActivo(banco: Banco): void {
    if (this.isSaving) return;
    const activo = !banco.activo;
    this.guardar(
      this.bancoService.actualizar(banco.id, { nombre: banco.nombre, activo }),
      `${banco.nombre} ${activo ? 'activado' : 'desactivado'}.`
    );
  }

  private guardar(peticion: Observable<Banco>, mensaje: string, alTerminar?: () => void): void {
    this.isSaving = true;
    this.errorMessage = '';
    peticion.subscribe({
      next: () => {
        this.isSaving = false;
        alTerminar?.();
        this.successMessage = mensaje;
        setTimeout(() => (this.successMessage = ''), 4000);
        this.cargar();
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo guardar el banco.';
      }
    });
  }

  trackById(_: number, banco: Banco): number {
    return banco.id;
  }
}
