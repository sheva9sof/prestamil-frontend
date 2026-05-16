import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  PlazoRequest,
  PlazoResponse,
  PlazoParametroRequest,
  PlazoParametroResponse,
  PlazoHechuraAlhajaResponse
} from '../models/plazo.model';

@Injectable({ providedIn: 'root' })
export class PlazoService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/plazos`;

  // === Plazos CRUD ===

  getAll(): Observable<PlazoResponse[]> {
    return this.http.get<PlazoResponse[]>(this.API_URL);
  }

  getById(id: number): Observable<PlazoResponse> {
    return this.http.get<PlazoResponse>(`${this.API_URL}/${id}`);
  }

  create(request: PlazoRequest): Observable<PlazoResponse> {
    return this.http.post<PlazoResponse>(this.API_URL, request);
  }

  update(id: number, request: PlazoRequest): Observable<PlazoResponse> {
    return this.http.put<PlazoResponse>(`${this.API_URL}/${id}`, request);
  }

  // === Parámetros multi-sucursal ===

  getParametrosBySucursal(plazoId: number, sucursalId: number = 1): Observable<PlazoParametroResponse[]> {
    return this.http.get<PlazoParametroResponse[]>(
      `${this.API_URL}/${plazoId}/parametros`,
      { params: { sucursalId: String(sucursalId) } }
    );
  }

  getParametro(plazoId: number, tipoPrendaId: number, sucursalId: number = 1): Observable<PlazoParametroResponse> {
    return this.http.get<PlazoParametroResponse>(
      `${this.API_URL}/${plazoId}/parametros/${tipoPrendaId}`,
      { params: { sucursalId: String(sucursalId) } }
    );
  }

  guardarParametro(
    plazoId: number,
    tipoPrendaId: number,
    request: PlazoParametroRequest,
    sucursalId: number = 1
  ): Observable<PlazoParametroResponse> {
    return this.http.put<PlazoParametroResponse>(
      `${this.API_URL}/${plazoId}/parametros/${tipoPrendaId}`,
      request,
      { params: { sucursalId: String(sucursalId) } }
    );
  }

  // === Tabla alhajas ===

  getTablaAlhajas(plazoId: number, sucursalId: number = 1): Observable<PlazoHechuraAlhajaResponse[]> {
    return this.http.get<PlazoHechuraAlhajaResponse[]>(
      `${this.API_URL}/${plazoId}/alhajas`,
      { params: { sucursalId: String(sucursalId) } }
    );
  }

  actualizarPrecioBase(
    plazoId: number,
    kilataje: number,
    hechura: string,
    precioBase: number,
    sucursalId: number = 1
  ): Observable<PlazoHechuraAlhajaResponse> {
    return this.http.put<PlazoHechuraAlhajaResponse>(
      `${this.API_URL}/${plazoId}/alhajas/${kilataje}/${hechura}`,
      { precioBase },
      { params: { sucursalId: String(sucursalId) } }
    );
  }

  actualizarTodosPrecios(
    plazoId: number,
    precioBaseOro: number,
    sucursalId: number = 1
  ): Observable<PlazoHechuraAlhajaResponse[]> {
    return this.http.put<PlazoHechuraAlhajaResponse[]>(
      `${this.API_URL}/${plazoId}/alhajas/precio-oro`,
      { precioBaseOro },
      { params: { sucursalId: String(sucursalId) } }
    );
  }
}
