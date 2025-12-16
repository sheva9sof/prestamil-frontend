import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Turno } from '../models/turno.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TurnoService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private readonly API = `${environment.apiUrl}/api/turnos`;

  private getAuthHeaders(): { headers: HttpHeaders; withCredentials: boolean } {
    return {
      headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
      withCredentials: true
    };
  }

  private currentTurnoSubject = new BehaviorSubject<Turno | null>(null);
  public currentTurno$ = this.currentTurnoSubject.asObservable();

  iniciar(): Observable<Turno> {
    console.debug('[TurnoService] iniciar() - usando autenticación con cookies');
    return this.http.post<Turno>(`${this.API}/iniciar`, {}, this.getAuthHeaders()).pipe(
      tap(t => this.currentTurnoSubject.next(t))
    );
  }

  cerrar(id: number): Observable<Turno> {
    console.debug('[TurnoService] cerrar() - usando autenticación con cookies');
    return this.http.post<Turno>(`${this.API}/cerrar/${id}`, {}, this.getAuthHeaders()).pipe(
      tap(t => this.currentTurnoSubject.next(t))
    );
  }

  activo(): Observable<Turno> {
    console.debug('[TurnoService] activo() - usando autenticación con cookies');
    return this.http.get<Turno>(`${this.API}/activo`, this.getAuthHeaders()).pipe(
      tap(t => this.currentTurnoSubject.next(t))
    );
  }

  refreshActivo(): void {
    this.activo().subscribe({ next: () => {}, error: () => this.currentTurnoSubject.next(null) });
  }

  isActivo(): boolean {
    const t = this.currentTurnoSubject.value;
    return !!t && !!t.activo;
  }
}
