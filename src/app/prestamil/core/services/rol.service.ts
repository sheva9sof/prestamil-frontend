import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface Rol {
  id: number;
  nombre: string; // backend returns 'nombre' for the role name
  descripcion?: string;
  estatus?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RolService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl + '/api/roles';

  private getAuthHeaders(): { headers?: HttpHeaders } {
    const token = localStorage.getItem('authToken');
    if (!token) return {};
    const value = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { headers: new HttpHeaders({ Authorization: value }) };
  }

  findAll(): Observable<Rol[]> {
    console.debug('[RolService] fetching roles from', this.API_URL);
    return this.http.get<Rol[]>(this.API_URL, this.getAuthHeaders());
  }
}
