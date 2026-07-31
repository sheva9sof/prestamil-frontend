export interface PartidaContratoRequest {
  idTipoPrenda: number;
  idValorPrenda?: number;
  clavePrenda?: string;
  descripcion: string;
  cantidad?: number;
  pesoGramos?: number;
  kilataje?: number;
  ley?: number;
  hechura?: string;
  precioXGramo?: number;
  avaluoReal: number;
  /** Opcional: el servidor lo recalcula cuando el plazo usa avalúo real. */
  avaluoContrato?: number;
  montoPrestamo: number;
  subtipo?: string;
  marca?: string;
  modelo?: string;
  serieImei?: string;
  estadoFisico?: string;
}

export interface ContratoRequest {
  idCliente: number;
  idPlazo: number;
  idBeneficiario?: number;
  nombreBeneficiario?: string;
  tipoIdentificacion?: string;
  numIdentificacion?: string;
  partidas: PartidaContratoRequest[];
}

export interface PartidaContratoResponse {
  id: number;
  numPartida: number;
  idTipoPrenda: number;
  tipoPrendaNombre?: string;
  idValorPrenda?: number;
  clavePrenda?: string;
  descripcion: string;
  cantidad: number;
  pesoGramos?: number;
  kilataje?: number;
  ley?: number;
  hechura?: string;
  precioXGramo?: number;
  avaluoReal: number;
  avaluoContrato: number;
  montoPrestamo: number;
  subtipo?: string;
  marca?: string;
  modelo?: string;
  serieImei?: string;
  estadoFisico?: string;
}

export interface ContratoResponse {
  id: number;
  folio: string;
  idCliente: number;
  nombreCliente?: string;
  idPlazo: number;
  nombrePlazo?: string;
  tipoIdentificacion?: string;
  numIdentificacion?: string;
  nombreBeneficiario?: string;
  fechaApertura: string;
  fechaVencimiento: string;
  montoPrestamo: number;
  montoAvaluo: number;
  estatus: 'VIGENTE' | 'VENCIDO' | 'DESEMPENADO' | 'EN_VENTA';
  numRefrendos: number;
  creadoEn?: string;
  partidas?: PartidaContratoResponse[];
}

// ============================================================
// Amortización (tabla de vencimientos calculada al vuelo)
// ============================================================

export interface VencimientoResponse {
  periodo: number;
  fecha: string;
  interes: number;
  total: number;
}

// ============================================================
// Movimientos (refrendos, finiquitos, reposición)
// ============================================================

export type TipoMovimiento =
  | 'REFRENDO'
  | 'REFRENDO_EXTEMPORANEO'
  | 'FINIQUITO'
  | 'FINIQUITO_EXTEMPORANEO'
  | 'ABONO'
  | 'REPOSICION_CONTRATO';

export interface RefrendoRequest {
  idContrato: number;
  abonoCapital?: number;
  observaciones?: string;
}

export interface MovimientoResponse {
  id: number;
  idContrato: number;
  folioContrato: string;
  tipo: TipoMovimiento;
  monto: number;
  interes: number;
  sancion: number;
  semanasVencidas: number;
  fecha: string;
  observaciones?: string;
  numRefrendos: number;
  nuevaFechaVencimiento?: string;
}
