import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ContratoRequest, ContratoResponse, VencimientoResponse } from '../models/contrato.model';

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

  getByCliente(clienteId: number): Observable<ContratoResponse[]> {
    return this.http.get<ContratoResponse[]>(`${this.API_URL}/cliente/${clienteId}`);
  }

  getVencidos(): Observable<ContratoResponse[]> {
    return this.http.get<ContratoResponse[]>(`${this.API_URL}/vencidos`);
  }

  /** Tabla de amortización (vencimientos por periodo) calculada al vuelo. */
  getAmortizacion(id: number): Observable<VencimientoResponse[]> {
    return this.http.get<VencimientoResponse[]>(`${this.API_URL}/${id}/amortizacion`);
  }
}
