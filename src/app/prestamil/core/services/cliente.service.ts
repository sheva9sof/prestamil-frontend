import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ClienteResponse } from '../models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/clientes`;

  search(q: string): Observable<ClienteResponse[]> {
    return this.http.get<ClienteResponse[]>(`${this.API_URL}/search`, { params: { q } });
  }

  getById(id: number): Observable<ClienteResponse> {
    return this.http.get<ClienteResponse>(`${this.API_URL}/${id}`);
  }
}
