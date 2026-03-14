import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Usuario, UsuarioResponse } from '../models/usuario.model';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl + '/api/usuarios';

  findAll(): Observable<UsuarioResponse[]> {
    return this.http.get<UsuarioResponse[]>(this.API_URL);
  }

  findPage(page: number, size: number): Observable<PageResponse<UsuarioResponse>> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<PageResponse<UsuarioResponse>>(`${this.API_URL}/page`, { params });
  }

  findById(id: number): Observable<UsuarioResponse> {
    return this.http.get<UsuarioResponse>(`${this.API_URL}/${id}`);
  }

  create(usuario: Usuario): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(this.API_URL, usuario);
  }

  update(id: number, usuario: Usuario): Observable<UsuarioResponse> {
    return this.http.put<UsuarioResponse>(`${this.API_URL}/${id}`, usuario);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`);
  }

  search(paramsObj: { nombre?: string; nombreUsuario?: string; estatus?: boolean }): Observable<UsuarioResponse[]> {
    let params = new HttpParams();
    if (paramsObj.nombre) params = params.set('nombre', paramsObj.nombre);
    if (paramsObj.nombreUsuario) params = params.set('nombreUsuario', paramsObj.nombreUsuario);
    if (paramsObj.estatus !== undefined && paramsObj.estatus !== null) params = params.set('estatus', String(paramsObj.estatus));
    return this.http.get<UsuarioResponse[]>(`${this.API_URL}/buscar`, { params });
  }
}
