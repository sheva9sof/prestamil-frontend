import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { RefrendoRequest, MovimientoResponse } from '../models/contrato.model';

@Injectable({ providedIn: 'root' })
export class MovimientoService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/movimientos`;

  /** Registra un refrendo (normal o extemporáneo) sobre un contrato. */
  refrendar(request: RefrendoRequest): Observable<MovimientoResponse> {
    return this.http.post<MovimientoResponse>(`${this.API_URL}/refrendo`, request);
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
