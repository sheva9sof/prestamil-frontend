import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ContratoRequest, ContratoResponse } from '../models/contrato.model';

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
}
