// ============================================================
// Requests
// ============================================================

export interface PlazoRequest {
  nombre: string;
  diasPorPeriodo: number;
  numeroPeriodos: number;
  activo: boolean;
  tiposPrenda: number[];
}

export interface PlazoParametroRequest {
  porcInteres?: number;
  porcAlmacen?: number;
  porcGastosAdmin?: number;
  porcInteresTotal?: number;
  cat?: number;
  numMaxRefrendos?: number;
  porcPrestamoSAvaluo?: number;
  usaAvaluoReal?: boolean;
  porcIncrementoAvaluo?: number;
  cobrarReposicionContrato?: boolean;
  reposicionEsPorcentaje?: boolean;
  porcReposicion?: number;
  montoReposicion?: number;
  comisionPorVentaPrenda?: number;
  aplicarSancionPorPeriodo?: boolean;
  porcSancionSemanal?: number;
  ley925?: number;
  ley725?: number;
  precioGramoPlata?: number;
  diasGraciaSinInteres?: number;
  diasAntesPaseVenta?: number;
  importeMinPrestamo?: number;
}

export interface PlazoHechuraAlhajaRequest {
  kilataje: number;
  hechura: 'F' | 'N' | 'E';
  precioBase: number;
  porcAumento: number;
}

// ============================================================
// Responses
// ============================================================

export interface TipoPrendaResponse {
  id: number;
  tipo: string;
}

export interface PlazoResponse {
  id: number;
  nombre: string;
  diasPorPeriodo: number;
  numeroPeriodos: number;
  activo: boolean;
  creadoEn?: string;
  actualizadoEn?: string;
  tiposPrenda?: TipoPrendaResponse[];
}

export interface PlazoParametroResponse {
  plazoId: number;
  tipoPrendaId: number;
  sucursalId: number;
  tipoPrenda?: TipoPrendaResponse;
  porcInteres: number;
  porcAlmacen: number;
  porcGastosAdmin: number;
  porcInteresTotal: number;
  cat: number;
  numMaxRefrendos: number;
  porcPrestamoSAvaluo: number;
  usaAvaluoReal: boolean;
  porcIncrementoAvaluo: number;
  cobrarReposicionContrato: boolean;
  reposicionEsPorcentaje: boolean;
  porcReposicion: number;
  montoReposicion: number;
  comisionPorVentaPrenda: number;
  aplicarSancionPorPeriodo: boolean;
  porcSancionSemanal: number;
  ley925: number;
  ley725: number;
  precioGramoPlata: number;
  diasGraciaSinInteres: number;
  diasAntesPaseVenta: number;
  importeMinPrestamo: number;
  creadoEn?: string;
  actualizadoEn?: string;
}

// ============================================================
// Precio del Oro (control global, fuera de los registros de cada plazo)
// ============================================================

export interface PrecioOroRequest {
  precioGramoBase: number;
  baseKilataje?: number;
  calcularSobre?: string;
}

export interface PrecioOroResponse {
  id: number;
  sucursalId: number;
  precioGramo24k: number;
  calcularSobre: string;
  baseKilataje: number;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

export interface PlazoHechuraAlhajaResponse {
  idPlazo: number;
  sucursalId: number;
  kilataje: number;
  hechura: string;
  hechuraDescripcion: string;
  precioBase: number;
  porcAumento: number;
  precioPrestamo: number;
}
