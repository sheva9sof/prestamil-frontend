import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs';

/**
 * Visor modal de un PDF de tamaño carta (p. ej. el contrato en la reposición). Se abre con NgbModal
 * pasando el observable que descarga el PDF; si falla, muestra el mensaje del backend y permite
 * reintentar sin repetir la operación que lo originó.
 */
@Component({
  selector: 'app-pdf-visor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-visor.component.html',
  styleUrls: ['./pdf-visor.component.scss']
})
export class PdfVisorComponent implements OnInit, OnDestroy {
  readonly activeModal = inject(NgbActiveModal);
  private sanitizer = inject(DomSanitizer);

  @Input() pdf$!: Observable<Blob>;
  @Input() titulo = 'Documento';
  /** Texto de confirmación arriba del PDF. */
  @Input() mensaje = '';
  @Input() nombreArchivo = 'documento.pdf';

  @ViewChild('visor') visor?: ElementRef<HTMLIFrameElement>;

  pdfUrl: SafeResourceUrl | null = null;
  isLoading = true;
  errorMessage = '';
  private blobUrl: string | null = null;

  ngOnInit(): void {
    this.cargar();
  }

  cargar(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.pdf$.subscribe({
      next: (blob) => {
        this.blobUrl = URL.createObjectURL(blob);
        this.pdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.blobUrl);
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'No se pudo generar el PDF.';
        // Con responseType 'blob' el cuerpo del error también llega como Blob: se lee para mostrar el mensaje
        const cuerpo = err?.error;
        if (cuerpo instanceof Blob) {
          cuerpo.text().then((texto) => {
            try {
              const message = JSON.parse(texto)?.message;
              if (message) this.errorMessage = `No se pudo generar el PDF: ${message}`;
            } catch {
              // Cuerpo no JSON: se queda el mensaje genérico
            }
          });
        }
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
    a.download = this.nombreArchivo;
    a.click();
  }

  ngOnDestroy(): void {
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
  }
}
