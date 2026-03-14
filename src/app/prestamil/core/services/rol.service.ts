import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  findAll(): Observable<Rol[]> {
    console.debug('[RolService] fetching roles from', this.API_URL);
    return this.http.get<Rol[]>(this.API_URL);
  }
}
