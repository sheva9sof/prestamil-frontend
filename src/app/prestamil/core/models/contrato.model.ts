export interface PartidaContratoRequest {
  idTipoPrenda: number;
  idValorPrenda?: number;
  clavePrenda?: string;
  descripcion: string;
  cantidad?: number;
  /** Peso del metal precioso (g), del lote completo. Es el que calcula avalúo y préstamo. */
  pesoNeto?: number;
  /** Peso físico total (g) incluyendo piedras y soldadura. Si se omite, el servidor lo iguala al neto. */
  pesoTotal?: number;
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
  /** Peso del metal precioso (g). Es el que se usó para calcular avalúo y préstamo. */
  pesoNeto?: number;
  /** Peso físico total (g) incluyendo piedras y soldadura. Informativo. */
  pesoTotal?: number;
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
  /** OP en operación, FIN finiquitada, VEN vendida, APA apartada. */
  estatus: 'OP' | 'FIN' | 'VEN' | 'APA';
}

export type EstatusContrato = 'VIGENTE' | 'VENCIDO' | 'EN_VENTA' | 'VENDIDO' | 'FINIQUITADO' | 'CANCELADO';

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
  /** Inicio del periodo vigente; cambia con cada refrendo. */
  fechaContrato: string;
  fechaVencimiento: string;
  /** Vencimiento + 15 días: desde esta fecha la prenda se puede vender. */
  fechaComercializacion?: string;
  montoPrestamo: number;
  /** Saldo de capital vigente (préstamo menos abonos a capital). */
  saldoCapital: number;
  montoAvaluo: number;
  estatus: EstatusContrato;
  numRefrendos: number;
  creadoEn?: string;
  partidas?: PartidaContratoResponse[];
}

// ============================================================
// Finiquitos y Refrendos: listado y detalle para operar en caja
// ============================================================

/** Estatus derivado de las fechas a hoy (el backend lo resuelve; EN_GRACIA y APARTADO no se persisten). */
export type EstatusOperativo =
  | 'VIGENTE'
  | 'EN_GRACIA'
  | 'VENCIDO'
  | 'EN_VENTA'
  | 'APARTADO'
  | 'VENDIDO'
  | 'FINIQUITADO'
  | 'CANCELADO';

/** Botones de la pantalla; solo se habilitan los que devuelve el backend (matriz RN-16). */
export type AccionContrato =
  | 'REFRENDO'
  | 'FINIQUITO'
  | 'ABONO_CAPITAL'
  | 'REFRENDO_PARCIAL'
  | 'REFRENDO_EXTEMPORANEO'
  | 'FINIQUITO_EXTEMPORANEO'
  | 'REPOSICION'
  | 'CONSULTA'
  | 'CANCELACION';

export type FiltroEstatusOperacion =
  | 'TODOS'
  | 'EN_OPERACION'
  | 'REFRENDADOS'
  | 'PERIODO_GRACIA'
  | 'VENCIDOS'
  | 'EN_VENTA'
  | 'VENDIDOS'
  | 'FINIQUITADOS'
  | 'CANCELADOS';

export type BuscarContratoPor = 'CONTRATO' | 'NUM_CLIENTE' | 'NOMBRE_CLIENTE' | 'FECHA_CONTRATO';

export interface ContratoOperacionFiltro {
  q?: string;
  buscarPor: BuscarContratoPor;
  /** Id del tipo de prenda; sin valor = todos los ramos. */
  ramo?: number | null;
  estatus: FiltroEstatusOperacion;
  page: number;
  size: number;
}

export interface ContratoOperacionResponse {
  id: number;
  folio: string;
  nombrePlazo: string;
  numeroPeriodos: number;
  diasPorPeriodo: number;
  /** Tipo de prenda de la primera partida. */
  ramo?: string;
  numPartidas: number;
  estatus: EstatusOperativo;
  numRefrendos: number;
  idCliente: number;
  nombreCliente: string;
  /** Inicio del periodo vigente. */
  fechaContrato: string;
  fechaVencimiento: string;
  diasGracia: number;
  fechaComercializacion?: string;
  montoPrestamo: number;
  saldoCapital: number;
  montoAvaluo: number;
  /** Interés + almacenaje de un periodo sobre el saldo, sin IVA. */
  interesPorPeriodo: number;
  accionesDisponibles: AccionContrato[];
}

export interface UltimoMovimientoResponse {
  id: number;
  tipo: TipoMovimiento;
  fecha: string;
  monto: number;
  nombreUsuario?: string;
}

export interface ContratoOperacionDetalleResponse extends ContratoOperacionResponse {
  /** Fecha de empeño original; nunca cambia. */
  fechaApertura: string;
  telefonoCliente?: string;
  nombreBeneficiario?: string;
  /** Situación a hoy; sin valor si el contrato ya no se puede cobrar. */
  diasAtraso?: number;
  periodosTranscurridos?: number;
  periodosNormales?: number;
  periodosExtemporaneos?: number;
  partidas: PartidaContratoResponse[];
  ultimoMovimiento?: UltimoMovimientoResponse;
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

/** Código corto del movimiento (EMP empeño, RF refrendo, RPG en gracia, RC con abono, RP/RPX parcial, RX/FX extemporáneos, FI finiquito, RE reposición, PV/PVA pase a venta, RM remanente). */
export type TipoMovimiento =
  | 'EMP'
  | 'RF'
  | 'RPG'
  | 'RC'
  | 'RP'
  | 'RPX'
  | 'RX'
  | 'FI'
  | 'FX'
  | 'RE'
  | 'PV'
  | 'PVA'
  | 'RM';

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
  /** Total cobrado (en EMP, el préstamo entregado). */
  monto: number;
  interes: number;
  sancion: number;
  abonoCapital: number;
  /** Periodos extemporáneos cubiertos. */
  semanasVencidas: number;
  periodosNormales?: number;
  diasGraciaUsados: number;
  interesPorPeriodo?: number;
  porcDescuentoInteres: number;
  importeDescuento: number;
  iva: number;
  fecha: string;
  observaciones?: string;
  nombreUsuario?: string;
  numRefrendos: number;
  nuevaFechaVencimiento?: string;

  importeEfectivo?: number;
  importeTarjeta?: number;
  tipoTarjeta?: 'CREDITO' | 'DEBITO';
  tarjetaUltimos4?: string;
  bancoEmisor?: string;
  autorizacionBanco?: string;
  cambioEntregado?: number;

  saldoAnterior?: number;
  saldoNuevo?: number;
  fechaContratoAnterior?: string;
  fechaVencAnterior?: string;
  fechaContratoNueva?: string;
  fechaVencNueva?: string;
  estatusAnterior?: EstatusContrato;
  estatusNuevo?: EstatusContrato;

  cancelado: boolean;
  fechaCancelacion?: string;
  usuarioCancela?: string;
  motivoCancelacion?: string;
}
