/**
 * Filtros comunes de los reportes (REP-00). Viajan como `?ramo=&desde=&hasta=` (ver `reporteFiltroParams`)
 * y el backend los recibe en `ReporteFiltro`.
 */
export interface ReporteFiltro {
  /** id de `tipo_prenda` (ALHAJA, VARIOS, PLATAS, AUTOS/MOTOS); null = todos los ramos. */
  ramo: number | null;
  /** Primer día del rango, yyyy-MM-dd. */
  desde: string;
  /** Último día del rango, yyyy-MM-dd. En los reportes de un solo día es igual a `desde`. */
  hasta: string;
}
