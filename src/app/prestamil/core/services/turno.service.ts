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

  private getAuthHeaders(): { headers?: HttpHeaders } {
    const token = this.authService.getToken();
    if (!token) return {};
    const value = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { headers: new HttpHeaders({ Authorization: value }) };
  }

  private currentTurnoSubject = new BehaviorSubject<Turno | null>(null);
  public currentTurno$ = this.currentTurnoSubject.asObservable();

  iniciar(): Observable<Turno> {
    // Log temporal para depuración: mostrar token y confirmar header esperado
    try {
      const token = this.authService.getToken();
      console.debug('[TurnoService] iniciar() - token (raw):', token);
      console.debug('[TurnoService] iniciar() - Authorization header expected:', token?.startsWith('Bearer ') ? token : `Bearer ${token}`);
    } catch (e) {
      console.warn('[TurnoService] iniciar() - error leyendo token:', e);
    }

    // según controlador, no requiere body
    return this.http.post<Turno>(`${this.API}/iniciar`, {}, this.getAuthHeaders()).pipe(
      tap(t => this.currentTurnoSubject.next(t))
    );
  }

  cerrar(id: number): Observable<Turno> {
    try {
      const token = this.authService.getToken();
      console.debug('[TurnoService] cerrar() - token (raw):', token);
      console.debug('[TurnoService] cerrar() - Authorization header expected:', token?.startsWith('Bearer ') ? token : `Bearer ${token}`);
    } catch (e) {
      console.warn('[TurnoService] cerrar() - error leyendo token:', e);
    }

    return this.http.post<Turno>(`${this.API}/cerrar/${id}`, {}, this.getAuthHeaders()).pipe(
      tap(t => this.currentTurnoSubject.next(t))
    );
  }

  activo(): Observable<Turno> {
    try {
      const token = this.authService.getToken();
      console.debug('[TurnoService] activo() - token (raw):', token);
      console.debug('[TurnoService] activo() - Authorization header expected:', token?.startsWith('Bearer ') ? token : `Bearer ${token}`);
    } catch (e) {
      console.warn('[TurnoService] activo() - error leyendo token:', e);
    }

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
