import { HttpParams } from '@angular/common/http';
import { ReporteFiltro } from '../models/reporte.model';

/** Query params de los filtros comunes de los reportes (REP-00); el ramo "Todos" no se manda. */
export function reporteFiltroParams(filtro: ReporteFiltro): HttpParams {
  let params = new HttpParams().set('desde', filtro.desde).set('hasta', filtro.hasta);
  if (filtro.ramo !== null) {
    params = params.set('ramo', filtro.ramo);
  }
  return params;
}

/** Descarga un archivo recibido como Blob (el "Exportar a Excel" de los reportes). */
export function descargarArchivo(blob: Blob, nombreArchivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Fecha de hoy del navegador en yyyy-MM-dd, para el valor inicial de los filtros. */
export function hoyIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
