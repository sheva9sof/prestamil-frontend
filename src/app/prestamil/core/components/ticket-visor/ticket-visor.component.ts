import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { MovimientoService } from '../../services/movimiento.service';

/**
 * Muestra la nota de un movimiento (ticket PDF de ~80 mm) para imprimirla. Se abre con NgbModal
 * pasando el id del movimiento; sirve tanto después de cobrar como para reimprimir.
 */
@Component({
  selector: 'app-ticket-visor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticket-visor.component.html',
  styleUrls: ['./ticket-visor.component.scss']
})
export class TicketVisorComponent implements OnInit, OnDestroy {
  readonly activeModal = inject(NgbActiveModal);
  private movimientoService = inject(MovimientoService);
  private sanitizer = inject(DomSanitizer);

  @Input() movimientoId!: number;
  @Input() titulo = 'Nota de movimiento';
  /** Texto de confirmación arriba del ticket, p. ej. "Refrendo registrado". */
  @Input() mensaje = '';

  @ViewChild('visor') visor?: ElementRef<HTMLIFrameElement>;

  pdfUrl: SafeResourceUrl | null = null;
  isLoading = true;
  errorMessage = '';
  private blobUrl: string | null = null;

  ngOnInit(): void {
    this.movimientoService.getTicket(this.movimientoId).subscribe({
      next: (blob) => {
        this.blobUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'No se pudo generar el ticket. El movimiento sí quedó registrado.';
      }
    });
  }

  imprimir(): void {
    const ventana = this.visor?.nativeElement.contentWindow;
    try {
      ventana?.focus();
      ventana?.print();
    } catch {
      // Algunos visores de PDF no permiten imprimir desde el iframe: se abre en otra pestaña
      if (this.blobUrl) window.open(this.blobUrl, '_blank');
    }
  }

  descargar(): void {
    if (!this.blobUrl) return;
    const a = document.createElement('a');
    a.href = this.blobUrl;
    a.download = `ticket-${this.movimientoId}.pdf`;
    a.click();
  }

  ngOnDestroy(): void {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
  }
}
