import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  CorteCajaRespuesta,
  Denominacion,
  TipoTraspasoCaja,
  TraspasoCaja,
  TraspasoCajaContexto,
  TraspasoCajaRequest
} from '../models/caja.model';

/** Traspasos entre cajas (CAJ-02, CAJ-03), catálogo de denominaciones y corte de caja (CAJ-07a). */
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

  /** Corte de caja del día (CAJ-07a); sin fecha, el de hoy. El cajero siempre recibe el de hoy. */
  corte(fecha?: string | null): Observable<CorteCajaRespuesta> {
    let params = new HttpParams();
    if (fecha) params = params.set('fecha', fecha);
    return this.http.get<CorteCajaRespuesta>(`${this.API_URL}/corte`, { params });
  }
}
