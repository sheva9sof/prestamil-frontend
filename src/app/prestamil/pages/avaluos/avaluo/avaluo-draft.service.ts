import { Injectable, inject } from '@angular/core';
import { AuthService } from 'src/app/prestamil/core/services/auth.service';

/**
 * Snapshot serializable de una captura de avaluos en curso.
 * El componente lo arma con su propio estado y el servicio lo persiste tal cual;
 * la forma la manda el componente, no el servicio.
 */
export interface AvaluoDraft {
  savedAt: string;
  tipoSeleccionado: string;
  plazoId: number | null;
  cliente: unknown | null;
  beneficiario: string;
  identificacionSeleccionada: string;
  partidas: unknown[];
  captura: unknown;
  capturaVarios: unknown;
  prestamoMaximoPlata: number;
  siguienteIdPartida: number;
}

/**
 * Persistencia local del borrador de avaluos. Vive por (usuario x sucursal) para que
 * los cajeros que comparten PC no pisen sus borradores, y para aislar por sucursal si
 * un mismo usuario opera en varias.
 *
 * La clave se versiona (SCHEMA_VERSION): si el schema cambia se descarta el borrador
 * viejo sin romper la pantalla.
 */
@Injectable({ providedIn: 'root' })
export class AvaluoDraftService {
  private auth = inject(AuthService);

  private readonly SCHEMA_VERSION = 1;
  private readonly KEY_PREFIX = 'avaluo-draft';

  private storageKey(sucursalId: number): string | null {
    const userId = this.auth.getUserId();
    if (userId == null) return null;
    return `${this.KEY_PREFIX}:v${this.SCHEMA_VERSION}:${userId}:${sucursalId}`;
  }

  load(sucursalId: number): AvaluoDraft | null {
    const key = this.storageKey(sucursalId);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AvaluoDraft;
    } catch {
      // JSON corrupto: se elimina para no reintentar cada carga.
      localStorage.removeItem(key);
      return null;
    }
  }

  save(sucursalId: number, draft: AvaluoDraft): void {
    const key = this.storageKey(sucursalId);
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(draft));
    } catch {
      // Cuota llena o modo privado: se ignora silenciosamente, la captura sigue viva
      // en memoria y solo se pierde el respaldo.
    }
  }

  clear(sucursalId: number): void {
    const key = this.storageKey(sucursalId);
    if (!key) return;
    localStorage.removeItem(key);
  }
}
