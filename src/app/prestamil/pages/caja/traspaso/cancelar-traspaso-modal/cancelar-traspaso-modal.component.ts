import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { TraspasoCaja } from 'src/app/prestamil/core/models/caja.model';
import { CajaService } from 'src/app/prestamil/core/services/caja.service';

/**
 * Cancela un traspaso del día (CAJ-02): el dinero regresa a la caja de origen y el traspaso queda
 * marcado, nunca se borra. Motivo obligatorio de 10 a 300 caracteres, como RN-26. Por ahora solo lo
 * abre Sistemas (TODO A-05: autorización de un gerente con `autorizacion-modal`).
 */
@Component({
  selector: 'app-cancelar-traspaso-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './cancelar-traspaso-modal.component.html'
})
export class CancelarTraspasoModalComponent {
  readonly activeModal = inject(NgbActiveModal);
  private cajaService = inject(CajaService);

  @Input() traspaso!: TraspasoCaja;

  motivo = '';
  isCancelando = false;
  errorMessage = '';

  get puedeConfirmar(): boolean {
    return this.motivo.trim().length >= 10 && !this.isCancelando;
  }

  confirmar(): void {
    if (!this.puedeConfirmar) return;
    this.isCancelando = true;
    this.errorMessage = '';
    this.cajaService.cancelar(this.traspaso.id, this.motivo.trim()).subscribe({
      next: (cancelado) => {
        this.isCancelando = false;
        this.activeModal.close(cancelado);
      },
      error: (err) => {
        this.isCancelando = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo cancelar el traspaso.';
      }
    });
  }

  moneda(valor: number): string {
    return '$' + valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
