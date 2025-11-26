import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Usuario, UsuarioResponse } from '../models/usuario.model';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl + '/api/usuarios';

  private getAuthHeaders(): { headers?: HttpHeaders } {
    const token = localStorage.getItem('authToken');
    if (!token) return {};
    const value = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { headers: new HttpHeaders({ Authorization: value }) };
  }

  findAll(): Observable<UsuarioResponse[]> {
    return this.http.get<UsuarioResponse[]>(this.API_URL, this.getAuthHeaders());
  }

  findPage(page: number, size: number): Observable<any> {
    const params = new HttpParams().set('page', String(page)).set('size', String(size));
    return this.http.get<any>(`${this.API_URL}/page`, { params, ...this.getAuthHeaders() });
  }

  findById(id: number): Observable<UsuarioResponse> {
    return this.http.get<UsuarioResponse>(`${this.API_URL}/${id}`, this.getAuthHeaders());
  }

  create(usuario: Usuario): Observable<UsuarioResponse> {
    return this.http.post<UsuarioResponse>(this.API_URL, usuario, this.getAuthHeaders());
  }

  update(id: number, usuario: Usuario): Observable<UsuarioResponse> {
    return this.http.put<UsuarioResponse>(`${this.API_URL}/${id}`, usuario, this.getAuthHeaders());
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/${id}`, this.getAuthHeaders());
  }

  search(paramsObj: { nombre?: string; nombreUsuario?: string; estatus?: boolean }): Observable<UsuarioResponse[]> {
    let params = new HttpParams();
    if (paramsObj.nombre) params = params.set('nombre', paramsObj.nombre);
    if (paramsObj.nombreUsuario) params = params.set('nombreUsuario', paramsObj.nombreUsuario);
    if (paramsObj.estatus !== undefined && paramsObj.estatus !== null) params = params.set('estatus', String(paramsObj.estatus));
    return this.http.get<UsuarioResponse[]>(`${this.API_URL}/buscar`, { params, ...this.getAuthHeaders() });
  }
}
