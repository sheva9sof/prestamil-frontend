import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

/** Fila de la pestaña "Cartera vencida" (C-11). */
export interface CarteraVencidaRow {
  folioContrato: string;
  cliente: string;
  direccion: string;
  telefono: string;
  fechaVencimiento: string;
  saldoCapital: number;
}

/** Fila de la pestaña "Pase a venta" (C-11). */
export interface PaseAVentaRow {
  folioContrato: string;
  numPartida: number;
  descripcion: string;
  fechaPase: string;
}

export interface ResultadosPaseAlmoneda {
  fecha: string;
  carteraVencida: CarteraVencidaRow[];
  paseAVenta: PaseAVentaRow[];
}

@Injectable({ providedIn: 'root' })
export class PaseAlmonedaService {
  private http = inject(HttpClient);
  private readonly API = `${environment.apiUrl}/api/pase-almoneda`;

  resultados(fecha: string): Observable<ResultadosPaseAlmoneda> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get<ResultadosPaseAlmoneda>(`${this.API}/resultados`, {
      params,
      withCredentials: true
    });
  }

  descargarCarteraVencida(fecha: string): Observable<Blob> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get(`${this.API}/cartera-vencida/excel`, {
      params,
      responseType: 'blob',
      withCredentials: true
    });
  }

  descargarPaseAVenta(fecha: string): Observable<Blob> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get(`${this.API}/pase-a-venta/excel`, {
      params,
      responseType: 'blob',
      withCredentials: true
    });
  }

  pdfCarteraVencida(fecha: string): Observable<Blob> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get(`${this.API}/cartera-vencida/pdf`, {
      params,
      responseType: 'blob',
      withCredentials: true
    });
  }

  pdfPaseAVenta(fecha: string): Observable<Blob> {
    const params = new HttpParams().set('fecha', fecha);
    return this.http.get(`${this.API}/pase-a-venta/pdf`, {
      params,
      responseType: 'blob',
      withCredentials: true
    });
  }
}
