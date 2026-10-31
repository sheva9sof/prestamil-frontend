import { Component, Input, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Denominacion, DesgloseCapturado, DesgloseDenominacion } from '../../models/caja.model';
import { CajaService } from '../../services/caja.service';

/**
 * Desglose por denominación (cantidad × denominación) con el total en vivo, para traspasos (CAJ-04) y
 * el arqueo del corte (CAJ-07a). Las denominaciones salen de GET /api/caja/denominaciones (solo las
 * activas), nunca de una lista fija. Se abre con NgbModal; al aceptar se cierra con un
 * {@link DesgloseCapturado} que trae solo los renglones con cantidad.
 */
@Component({
  selector: 'app-denominaciones-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './denominaciones-modal.component.html',
  styleUrls: ['./denominaciones-modal.component.scss']
})
export class DenominacionesModalComponent implements OnInit {
  readonly activeModal = inject(NgbActiveModal);
  private cajaService = inject(CajaService);

  @Input() titulo = 'Desglose por denominación';
  /** Texto chico arriba del título, p. ej. "Dotación · BÓVEDA → VENTANILLA". */
  @Input() subtitulo = '';
  /** Desglose ya capturado, para corregirlo sin volver a teclear todo. */
  @Input() desgloseInicial: DesgloseDenominacion[] = [];

  billetes: Denominacion[] = [];
  monedas: Denominacion[] = [];
  /** Billetes a la izquierda y monedas a la derecha, como en el arqueo de COCAE. */
  grupos: { nombre: string; lista: Denominacion[] }[] = [];
  /** Cantidad capturada por id de denominación. */
  cantidades: Record<number, number | null> = {};

  isLoading = true;
  errorMessage = '';

  ngOnInit(): void {
    this.cajaService.denominaciones().subscribe({
      next: (denominaciones) => {
        this.billetes = denominaciones.filter((d) => d.tipo === 'BILLETE');
        this.monedas = denominaciones.filter((d) => d.tipo === 'MONEDA');
        this.grupos = [
          { nombre: 'Billetes', lista: this.billetes },
          { nombre: 'Monedas', lista: this.monedas }
        ];
        for (const renglon of this.desgloseInicial) {
          this.cantidades[renglon.denominacionId] = renglon.cantidad;
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo cargar el catálogo de denominaciones.';
      }
    });
  }

  /** Importe del renglón en centavos, para que el total no arrastre errores de punto flotante. */
  centavos(denominacion: Denominacion): number {
    return Math.round(denominacion.valor * 100) * this.cantidad(denominacion);
  }

  importe(denominacion: Denominacion): number {
    return this.centavos(denominacion) / 100;
  }

  get totalCentavos(): number {
    return [...this.billetes, ...this.monedas].reduce((suma, d) => suma + this.centavos(d), 0);
  }

  get total(): number {
    return this.totalCentavos / 100;
  }

  get piezas(): number {
    return [...this.billetes, ...this.monedas].reduce((suma, d) => suma + this.cantidad(d), 0);
  }

  /** Por qué todavía no se puede aceptar; null si el desglose es válido. */
  get motivoInvalido(): string | null {
    const todas = [...this.billetes, ...this.monedas];
    if (todas.some((d) => !this.cantidadValida(this.cantidades[d.id]))) {
      return 'Las cantidades deben ser números enteros sin signo.';
    }
    if (this.totalCentavos <= 0) {
      return 'Captura al menos una pieza.';
    }
    return null;
  }

  limpiar(): void {
    this.cantidades = {};
  }

  aceptar(): void {
    if (this.motivoInvalido) return;
    const renglones: DesgloseDenominacion[] = [...this.billetes, ...this.monedas]
      .filter((d) => this.cantidad(d) > 0)
      .map((d) => ({
        denominacionId: d.id,
        valor: d.valor,
        cantidad: this.cantidad(d),
        importe: this.importe(d)
      }));
    const resultado: DesgloseCapturado = { renglones, total: this.total };
    this.activeModal.close(resultado);
  }

  private cantidad(denominacion: Denominacion): number {
    const cantidad = this.cantidades[denominacion.id];
    return this.cantidadValida(cantidad) && cantidad ? cantidad : 0;
  }

  private cantidadValida(cantidad: number | null | undefined): boolean {
    return cantidad == null || (Number.isInteger(cantidad) && cantidad >= 0);
  }
}
