import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  ContratoOperacionDetalleResponse,
  ContratoOperacionFiltro,
  ContratoOperacionResponse,
  ContratoRequest,
  ContratoResponse,
  VencimientoResponse
} from '../models/contrato.model';
import { PageResponse } from '../models/page.model';

@Injectable({ providedIn: 'root' })
export class ContratoService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/contratos`;

  crear(request: ContratoRequest): Observable<ContratoResponse> {
    return this.http.post<ContratoResponse>(this.API_URL, request);
  }

  getById(id: number): Observable<ContratoResponse> {
    return this.http.get<ContratoResponse>(`${this.API_URL}/${id}`);
  }

  getByFolio(folio: string): Observable<ContratoResponse> {
    return this.http.get<ContratoResponse>(`${this.API_URL}/folio/${folio}`);
  }

  getVencidos(): Observable<ContratoResponse[]> {
    return this.http.get<ContratoResponse[]>(`${this.API_URL}/vencidos`);
  }

  /** Listado de Finiquitos y Refrendos con búsqueda y filtros; estatus y acciones vienen resueltos a hoy. */
  buscarOperacion(filtro: ContratoOperacionFiltro): Observable<PageResponse<ContratoOperacionResponse>> {
    let params = new HttpParams()
      .set('buscarPor', filtro.buscarPor)
      .set('estatus', filtro.estatus)
      .set('page', filtro.page)
      .set('size', filtro.size);
    if (filtro.q?.trim()) {
      params = params.set('q', filtro.q.trim());
    }
    if (filtro.ramo != null) {
      params = params.set('ramo', filtro.ramo);
    }
    return this.http.get<PageResponse<ContratoOperacionResponse>>(`${this.API_URL}/operacion`, { params });
  }

  /** Detalle de un contrato con las acciones que se pueden ejecutar hoy. */
  getOperacion(id: number): Observable<ContratoOperacionDetalleResponse> {
    return this.http.get<ContratoOperacionDetalleResponse>(`${this.API_URL}/${id}/operacion`);
  }

  /** Tabla de amortización (vencimientos por periodo) calculada al vuelo. */
  getAmortizacion(id: number): Observable<VencimientoResponse[]> {
    return this.http.get<VencimientoResponse[]>(`${this.API_URL}/${id}/amortizacion`);
  }

  /** PDF del contrato de mutuo (para visualizarlo/imprimirlo en el sistema). */
  getPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.API_URL}/${id}/pdf`, { responseType: 'blob' });
  }
}
