import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CatSubtipoPrendaResponse, CatValorPrendaResponse } from '../models/cliente.model';

@Injectable({ providedIn: 'root' })
export class PrendaService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/api/prendas`;

  getSubtipos(tipoPrendaId: number): Observable<CatSubtipoPrendaResponse[]> {
    return this.http.get<CatSubtipoPrendaResponse[]>(`${this.API_URL}/subtipos/${tipoPrendaId}`);
  }

  getValores(idAtributo: number): Observable<CatValorPrendaResponse[]> {
    return this.http.get<CatValorPrendaResponse[]>(`${this.API_URL}/valores/${idAtributo}`);
  }
}
