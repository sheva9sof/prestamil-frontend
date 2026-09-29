import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Banco, BancoRequest } from '../models/banco.model';

@Injectable({ providedIn: 'root' })
export class BancoService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/bancos`;

  /** Bancos por nombre; con `soloActivos` solo los que ofrece la ventana de Cobro. */
  listar(soloActivos = false): Observable<Banco[]> {
    return this.http.get<Banco[]>(this.API_URL, { params: new HttpParams().set('soloActivos', soloActivos) });
  }

  crear(request: BancoRequest): Observable<Banco> {
    return this.http.post<Banco>(this.API_URL, request);
  }

  /** Cambia el nombre o activa/desactiva el banco (no hay borrado). */
  actualizar(id: number, request: BancoRequest): Observable<Banco> {
    return this.http.put<Banco>(`${this.API_URL}/${id}`, request);
  }
}
