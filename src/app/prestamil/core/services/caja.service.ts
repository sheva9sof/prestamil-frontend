import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { reporteFiltroParams } from '../helpers/reporte.helper';
import {
  ArranqueCaja,
  ArranqueCajaRequest,
  CierreCaja,
  CorteCajaRespuesta,
  Denominacion,
  TipoTraspasoCaja,
  TraspasoCaja,
  TraspasoCajaContexto,
  TraspasoCajaRequest
} from '../models/caja.model';

/**
 * Traspasos entre cajas (CAJ-02, CAJ-03), catálogo de denominaciones, corte de caja (CAJ-07a) y su
 * reporte en PDF y Excel (REP-04), cierre de día y saldo de arranque (CAJ-06).
 */
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

  /** Corte de caja de un día en PDF (REP-04). El cajero siempre recibe el de hoy. */
  cortePdf(fecha: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/corte/pdf`, {
      params: reporteFiltroParams({ ramo: null, desde: fecha, hasta: fecha }),
      responseType: 'blob'
    });
  }

  /** Corte de caja de un día en Excel (.xlsx), mismas reglas que el PDF. */
  corteExcel(fecha: string): Observable<Blob> {
    return this.http.get(`${this.API_URL}/corte/excel`, {
      params: reporteFiltroParams({ ramo: null, desde: fecha, hasta: fecha }),
      responseType: 'blob'
    });
  }

  /** Cierra el día de caja (CAJ-06): el gerente el de hoy, Sistemas uno pendiente. */
  cerrarDia(fecha: string): Observable<CierreCaja> {
    return this.http.post<CierreCaja>(`${this.API_URL}/cierre`, { fecha });
  }

  arranque(): Observable<ArranqueCaja> {
    return this.http.get<ArranqueCaja>(`${this.API_URL}/arranque`);
  }

  /** Captura del saldo de arranque y los folios de COCAE; solo Sistemas y una sola vez. */
  capturarArranque(request: ArranqueCajaRequest): Observable<ArranqueCaja> {
    return this.http.put<ArranqueCaja>(`${this.API_URL}/arranque`, request);
  }
}
