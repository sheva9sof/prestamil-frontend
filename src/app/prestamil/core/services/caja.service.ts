import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  Denominacion,
  TipoTraspasoCaja,
  TraspasoCaja,
  TraspasoCajaContexto,
  TraspasoCajaRequest
} from '../models/caja.model';

/** Traspasos entre cajas (CAJ-02, CAJ-03) y catálogo de denominaciones. */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/caja`;

  /** Denominaciones activas de mayor a menor; el modal de desglose no tiene ninguna fija. */
  denominaciones(): Observable<Denominacion[]> {
    return this.http.get<Denominacion[]>(`${this.API_URL}/denominaciones`);
  }

  contexto(tipo: TipoTraspasoCaja): Observable<TraspasoCajaContexto> {
    return this.http.get<TraspasoCajaContexto>(`${this.API_URL}/traspasos/contexto`, {
      params: new HttpParams().set('tipo', tipo)
    });
  }

  /** Traspasos del día del servidor (todos los estatus), del tipo indicado. */
  traspasosDelDia(tipo: TipoTraspasoCaja): Observable<TraspasoCaja[]> {
    return this.http.get<TraspasoCaja[]>(`${this.API_URL}/traspasos`, {
      params: new HttpParams().set('tipo', tipo)
    });
  }

  registrar(request: TraspasoCajaRequest): Observable<TraspasoCaja> {
    return this.http.post<TraspasoCaja>(`${this.API_URL}/traspasos`, request);
  }

  cancelar(id: number, motivo: string): Observable<TraspasoCaja> {
    return this.http.post<TraspasoCaja>(`${this.API_URL}/traspasos/${id}/cancelar`, { motivo });
  }

  ticket(id: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/traspasos/${id}/ticket`, { responseType: 'blob' });
  }
}
