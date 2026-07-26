import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { OroCeldaResponse, PrecioGramoRequest, PrecioGramoResponse } from '../models/oro-config.model';

@Injectable({ providedIn: 'root' })
export class OroConfigService {
  private readonly http = inject(HttpClient);
  private readonly API_ORO = `${environment.apiUrl}/api/oro-tabla-prestamo`;
  private readonly API_PRECIO = `${environment.apiUrl}/api/precio-oro`;

  /**
   * Obtiene las 24 celdas de la tabla de préstamo de oro (8 kilates x 3 hechuras) de la sucursal.
   * @param sucursalId id de la sucursal (default 1)
   * @returns Observable con el arreglo de 24 celdas
   */
  getTablaOro(sucursalId = 1): Observable<OroCeldaResponse[]> {
    return this.http.get<OroCeldaResponse[]>(this.API_ORO, {
      params: { sucursalId: String(sucursalId) }
    });
  }

  /**
   * Actualiza el %Prestamo de una celda específica (kilataje x hechura) y dispara la
   * cascada de recálculo de todas las tablas dependientes en el servidor.
   * @param kilataje kilataje de la celda (6,8,10,12,14,18,21,24)
   * @param hechura código de hechura ('F' | 'N' | 'E')
   * @param porcPrestamo nuevo porcentaje de préstamo
   * @param sucursalId id de la sucursal (default 1)
   * @returns Observable con la celda actualizada
   */
  actualizarCelda(kilataje: number, hechura: string, porcPrestamo: number, sucursalId = 1): Observable<OroCeldaResponse> {
    return this.http.put<OroCeldaResponse>(
      `${this.API_ORO}/${kilataje}/${hechura}`,
      { porcPrestamo },
      { params: { sucursalId: String(sucursalId) } }
    );
  }

  /**
   * Obtiene el precio del gramo de oro 24K vigente para la sucursal.
   * @param sucursalId id de la sucursal (default 1)
   * @returns Observable con el precio del gramo
   */
  getPrecioGramo(sucursalId = 1): Observable<PrecioGramoResponse> {
    return this.http.get<PrecioGramoResponse>(this.API_PRECIO, {
      params: { sucursalId: String(sucursalId) }
    });
  }

  /**
   * Guarda un nuevo precio del gramo de oro 24K y los factores de ajuste por hechura
   * (Fundir/Normal/Especial), y recalcula todas las tablas de la sucursal. Los factores
   * son opcionales: si no se envían, el servidor conserva los valores vigentes.
   * @param body precio del gramo base y factores por hechura
   * @param sucursalId id de la sucursal (default 1)
   * @returns Observable con el precio actualizado
   */
  actualizarPrecioGramo(body: PrecioGramoRequest, sucursalId = 1): Observable<PrecioGramoResponse> {
    return this.http.put<PrecioGramoResponse>(
      this.API_PRECIO,
      body,
      { params: { sucursalId: String(sucursalId) } }
    );
  }
}
