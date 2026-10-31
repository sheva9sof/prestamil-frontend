import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { DenominacionesModalComponent } from '../../../core/components/denominaciones-modal/denominaciones-modal.component';
import { PdfVisorComponent } from '../../../core/components/pdf-visor/pdf-visor.component';
import {
  DesgloseCapturado,
  TipoTraspasoCaja,
  TraspasoCaja,
  TraspasoCajaContexto
} from '../../../core/models/caja.model';
import { CajaService } from '../../../core/services/caja.service';
import { CancelarTraspasoModalComponent } from './cancelar-traspaso-modal/cancelar-traspaso-modal.component';

export const NOMBRE_TRASPASO: Record<TipoTraspasoCaja, string> = {
  MINISTRACION: 'Ministración',
  CONCENTRACION: 'Concentración',
  DOTACION: 'Dotación',
  RECOLECCION: 'Recolección'
};

const PLURAL_TRASPASO: Record<TipoTraspasoCaja, string> = {
  MINISTRACION: 'Ministraciones',
  CONCENTRACION: 'Concentraciones',
  DOTACION: 'Dotaciones',
  RECOLECCION: 'Recolecciones'
};

/**
 * Pantalla única de los cuatro traspasos entre cajas (CAJ-04, RC-02). El tipo llega en `data.tipo`
 * de la ruta (/caja/ministracion, /caja/concentracion, /caja/dotacion, /caja/recoleccion) y fija las
 * cajas. La fecha es la del servidor (evita el 30/DIC/1899 de COCAE) y el importe solo se llena desde
 * el desglose por denominación. Abajo, los traspasos del día de ese tipo con reimprimir y cancelar.
 */
@Component({
  selector: 'app-traspaso',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './traspaso.component.html',
  styleUrls: ['./traspaso.component.scss']
})
export class TraspasoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private cajaService = inject(CajaService);
  private modalService = inject(NgbModal);

  tipo!: TipoTraspasoCaja;
  contexto: TraspasoCajaContexto | null = null;
  traspasos: TraspasoCaja[] = [];

  desglose: DesgloseCapturado | null = null;
  referenciaBancaria = '';

  isLoading = true;
  isLoadingLista = false;
  isGuardando = false;
  errorMessage = '';
  listaError = '';
  successMessage = '';

  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.tipo = data['tipo'] as TipoTraspasoCaja;
      this.limpiar();
      this.successMessage = '';
      this.cargarContexto();
      this.cargarTraspasos();
    });
  }

  get nombre(): string {
    return NOMBRE_TRASPASO[this.tipo];
  }

  get plural(): string {
    return PLURAL_TRASPASO[this.tipo];
  }

  /** La referencia bancaria relaciona la concentración con el depósito en el banco (Q-07). */
  get esConcentracion(): boolean {
    return this.tipo === 'CONCENTRACION';
  }

  get importe(): number {
    return this.desglose?.total ?? 0;
  }

  get puedeGuardar(): boolean {
    return !!this.contexto?.puedeRegistrar && this.importe > 0 && !this.isGuardando;
  }

  get totalActivos(): number {
    return this.traspasos
      .filter((t) => t.estatus === 'ACTIVO')
      .reduce((suma, t) => suma + Math.round(t.importe * 100), 0) / 100;
  }

  cargarContexto(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.cajaService.contexto(this.tipo).subscribe({
      next: (contexto) => {
        this.contexto = contexto;
        this.isLoading = false;
      },
      error: (err) => {
        this.contexto = null;
        this.isLoading = false;
        this.errorMessage = err?.error?.message ?? 'No se pudo cargar la información de las cajas.';
      }
    });
  }

  cargarTraspasos(): void {
    this.isLoadingLista = true;
    this.listaError = '';
    this.cajaService.traspasosDelDia(this.tipo).subscribe({
      next: (traspasos) => {
        // El último arriba: es el que se suele reimprimir o cancelar
        this.traspasos = [...traspasos].reverse();
        this.isLoadingLista = false;
      },
      error: (err) => {
        this.isLoadingLista = false;
        this.listaError = err?.error?.message ?? 'No se pudieron cargar los traspasos del día.';
      }
    });
  }

  abrirDesglose(): void {
    if (!this.contexto?.puedeRegistrar || this.isGuardando) return;
    const ref = this.modalService.open(DenominacionesModalComponent, { size: 'lg', centered: true, scrollable: true });
    const modal = ref.componentInstance as DenominacionesModalComponent;
    modal.titulo = `Desglose de la ${this.nombre.toLowerCase()}`;
    modal.subtitulo = this.ruta;
    modal.desgloseInicial = this.desglose?.renglones ?? [];
    ref.result.then(
      (desglose: DesgloseCapturado) => {
        this.desglose = desglose;
        this.successMessage = '';
      },
      () => undefined
    );
  }

  guardar(): void {
    if (!this.puedeGuardar || !this.desglose) return;
    this.isGuardando = true;
    this.errorMessage = '';
    this.successMessage = '';
    this.cajaService
      .registrar({
        tipo: this.tipo,
        importe: this.desglose.total,
        desglose: this.desglose.renglones.map((r) => ({ denominacionId: r.denominacionId, cantidad: r.cantidad })),
        referenciaBancaria: this.esConcentracion ? this.referenciaBancaria.trim() || null : null
      })
      .subscribe({
        next: (traspaso) => {
          this.isGuardando = false;
          this.limpiar();
          this.successMessage = `${this.nombre} ${traspaso.folio} registrada por $${this.moneda(traspaso.importe)}.`;
          this.cargarTraspasos();
          this.verTicket(traspaso, this.successMessage);
        },
        error: (err) => {
          this.isGuardando = false;
          this.errorMessage = err?.error?.message ?? `No se pudo registrar la ${this.nombre.toLowerCase()}.`;
        }
      });
  }

  limpiar(): void {
    this.desglose = null;
    this.referenciaBancaria = '';
    this.errorMessage = '';
  }

  verTicket(traspaso: TraspasoCaja, mensaje = ''): void {
    const ref = this.modalService.open(PdfVisorComponent, { centered: true, scrollable: true });
    const visor = ref.componentInstance as PdfVisorComponent;
    visor.pdf$ = this.cajaService.ticket(traspaso.id);
    visor.titulo = `${NOMBRE_TRASPASO[traspaso.tipo]} ${traspaso.folio}`;
    visor.mensaje = mensaje;
    visor.nombreArchivo = `traspaso-${traspaso.tipo.toLowerCase()}-${traspaso.folio}.pdf`;
  }

  cancelar(traspaso: TraspasoCaja): void {
    const ref = this.modalService.open(CancelarTraspasoModalComponent, { centered: true, backdrop: 'static' });
    const modal = ref.componentInstance as CancelarTraspasoModalComponent;
    modal.traspaso = traspaso;
    ref.result.then(
      (cancelado: TraspasoCaja) => {
        this.successMessage = `${NOMBRE_TRASPASO[cancelado.tipo]} ${cancelado.folio} cancelada.`;
        this.cargarTraspasos();
      },
      () => undefined
    );
  }

  get ruta(): string {
    if (!this.contexto) return '';
    return `${this.contexto.cajaOrigen.nombre} → ${this.contexto.cajaDestino.nombre}`;
  }

  /** "2026-10-31" → "31/10/2026" sin pasar por Date, que la tomaría como UTC y mostraría el día anterior. */
  fechaCorta(iso: string | null | undefined): string {
    if (!iso) return '';
    const [anio, mes, dia] = iso.substring(0, 10).split('-');
    return `${dia}/${mes}/${anio}`;
  }

  moneda(valor: number): string {
    return valor.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
