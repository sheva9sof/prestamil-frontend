import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CatSubtipoPrendaResponse, CatValorPrendaResponse } from '../models/cliente.model';

export interface TipoPrendaResponse {
  id: number;
  tipo: string;
}

export interface CatValorPrendaRequest {
  idTipoPrenda: number;
  idAtributo: number;
  /** Nombre histórico del catálogo. Ya no se captura en el modal; si se omite, el backend conserva el existente. */
  descripcion?: string;
  clave: string;
  kilataje: number | null;
  contienePiedad: boolean;
}

@Injectable({ providedIn: 'root' })
export class PrendaService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/prendas`;

  getTipos(): Observable<TipoPrendaResponse[]> {
    return this.http.get<TipoPrendaResponse[]>(`${this.API_URL}/tipos`);
  }

  getSubtipos(tipoPrendaId: number): Observable<CatSubtipoPrendaResponse[]> {
    return this.http.get<CatSubtipoPrendaResponse[]>(`${this.API_URL}/subtipos/${tipoPrendaId}`);
  }

  getValores(idAtributo: number): Observable<CatValorPrendaResponse[]> {
    return this.http.get<CatValorPrendaResponse[]>(`${this.API_URL}/valores/${idAtributo}`);
  }

  getAllValores(): Observable<CatValorPrendaResponse[]> {
    return this.http.get<CatValorPrendaResponse[]>(`${this.API_URL}/valores`);
  }

  createValor(request: CatValorPrendaRequest): Observable<CatValorPrendaResponse> {
    return this.http.post<CatValorPrendaResponse>(`${this.API_URL}/valores`, request);
  }

  updateValor(idValorAtributo: number, request: CatValorPrendaRequest): Observable<CatValorPrendaResponse> {
    return this.http.put<CatValorPrendaResponse>(`${this.API_URL}/valores/${idValorAtributo}`, request);
  }

  /** Borrado físico. El backend responde 400 si la prenda ya se usó en un contrato. */
  deleteValor(idValorAtributo: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/valores/${idValorAtributo}`);
  }
}
