import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CotizacionMovimientoResponse,
  CotizacionRequest,
  MovimientoRequest,
  MovimientoResponse
} from '../models/contrato.model';

@Injectable({ providedIn: 'root' })
export class MovimientoService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/movimientos`;

  /** Cotiza una operación a la fecha del servidor, sin registrarla. */
  cotizar(request: CotizacionRequest): Observable<CotizacionMovimientoResponse> {
    return this.http.post<CotizacionMovimientoResponse>(`${this.API_URL}/cotizacion`, request);
  }

  /** Registra el movimiento con su forma de pago; el backend recalcula los montos. */
  registrar(request: MovimientoRequest): Observable<MovimientoResponse> {
    return this.http.post<MovimientoResponse>(this.API_URL, request);
  }

  /** Nota del movimiento (ticket de ~80 mm) en PDF. */
  getTicket(movimientoId: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${movimientoId}/ticket`, { responseType: 'blob' });
  }

  /** Ticket del último movimiento vigente del contrato (RN-22). 404 si no hay movimiento cobrado. */
  getTicketVigente(contratoId: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/contrato/${contratoId}/ticket-vigente`, { responseType: 'blob' });
  }

  /** Cobra la reposición/reimpresión de un contrato y la registra en caja. */
  cobrarReposicion(contratoId: number): Observable<MovimientoResponse> {
    return this.http.post<MovimientoResponse>(`${this.API_URL}/reposicion/${contratoId}`, {});
  }

  /** Lista los movimientos de un contrato en orden cronológico. */
  getMovimientos(contratoId: number): Observable<MovimientoResponse[]> {
    return this.http.get<MovimientoResponse[]>(`${this.API_URL}/contrato/${contratoId}`);
  }
}
