/** Los cuatro traspasos entre cajas (RC-02). El tipo fija la caja de origen y la de destino. */
export type TipoTraspasoCaja = 'MINISTRACION' | 'CONCENTRACION' | 'DOTACION' | 'RECOLECCION';

export type EstatusTraspasoCaja = 'ACTIVO' | 'CANCELADO';

export type TipoCaja = 'CONCENTRADORA' | 'BOVEDA' | 'VENTANILLA';

/** Denominación activa del catálogo (Q-10: sin 0.01, con 0.05). Viene de GET /api/caja/denominaciones. */
export interface Denominacion {
  id: number;
  valor: number;
  tipo: 'BILLETE' | 'MONEDA';
  orden: number;
  activa: boolean;
}

/** Renglón que devuelve `denominaciones-modal`: solo las denominaciones con cantidad mayor a cero. */
export interface DesgloseDenominacion {
  denominacionId: number;
  valor: number;
  cantidad: number;
  importe: number;
}

/** Lo que devuelve `denominaciones-modal` al aceptar. */
export interface DesgloseCapturado {
  renglones: DesgloseDenominacion[];
  total: number;
}

export interface Caja {
  id: number;
  sucursalId: number;
  tipo: TipoCaja;
  clave: string;
  nombre: string;
  activa: boolean;
}

/** GET /api/caja/traspasos/contexto: cajas que fija el tipo, fecha del servidor y permisos. */
export interface TraspasoCajaContexto {
  tipo: TipoTraspasoCaja;
  fechaOperacion: string;
  cajaOrigen: Caja;
  cajaDestino: Caja;
  puedeRegistrar: boolean;
  puedeCancelar: boolean;
  /** La caja de hoy ya se cerró (CAJ-06): no se registra ni se cancela nada. */
  diaCerrado: boolean;
}

/** El servidor pone cajas, fecha y folio; el importe lo coteja contra la suma del desglose (RC-03). */
export interface TraspasoCajaRequest {
  tipo: TipoTraspasoCaja;
  importe: number;
  desglose: { denominacionId: number; cantidad: number }[];
  referenciaBancaria?: string | null;
}

export interface TraspasoCaja {
  id: number;
  sucursalId: number;
  folio: number;
  tipo: TipoTraspasoCaja;
  cajaOrigenId: number;
  cajaOrigenClave: string;
  cajaOrigenNombre: string;
  cajaDestinoId: number;
  cajaDestinoClave: string;
  cajaDestinoNombre: string;
  importe: number;
  fechaOperacion: string;
  fechaRegistro: string;
  usuarioId: number;
  nombreUsuario: string;
  turnoId: number | null;
  referenciaBancaria: string | null;
  estatus: EstatusTraspasoCaja;
  fechaCancelacion: string | null;
  nombreUsuarioCancela: string | null;
  motivoCancelacion: string | null;
  desglose: { denominacionId: number; valor: number; cantidad: number; importe: number }[];
}

// ── Corte de caja (CAJ-07a) ────────────────────────────────────────────────

export type RenglonCorte =
  | 'DOTACIONES'
  | 'EMPENOS'
  | 'INDEMNIZACIONES'
  | 'DEVOLUCIONES'
  | 'DEMASIAS'
  | 'ABONOS_PARCIALES'
  | 'ABONOS_CAPITAL'
  | 'APARTADOS'
  | 'FINIQUITOS'
  | 'FINIQUITOS_EXTEMPORANEOS'
  | 'REFRENDOS'
  | 'REFRENDOS_EXTEMPORANEOS'
  | 'REPOSICIONES'
  | 'VENTAS'
  | 'RECOLECCION';

/** Renglón del bloque superior, en el orden del PDF de COCAE. Solo el efectivo entra al arqueo (RC-06). */
export interface CorteCajaRenglon {
  renglon: RenglonCorte;
  etiqueta: string;
  columna: 'INGRESO' | 'EGRESO';
  efectivo: number;
  tarjeta: number;
}

export interface CorteCajaTotales {
  efectivo: number;
  tarjeta: number;
}

/**
 * `CorteCajaResultado` del backend. Si `aviso` viene, el corte no tiene cifras (antes del arranque o sin
 * saldo de arranque): los renglones vienen vacíos y los importes en null.
 */
export interface CorteCaja {
  sucursalId: number;
  fecha: string;
  aviso: string | null;
  renglones: CorteCajaRenglon[];
  ingresos: CorteCajaTotales | null;
  egresos: CorteCajaTotales | null;
  saldoAnterior: number | null;
  ministraciones: number | null;
  concentraciones: number | null;
  boveda: number | null;
  dotaciones: number | null;
  ingresosEfectivo: number | null;
  egresosEfectivo: number | null;
  recolecciones: number | null;
  /** Lo que debería quedar en la gaveta (RC-07). */
  diferencia: number | null;
  /** F si la diferencia es mayor que 0, S si es menor, null si es 0. */
  indicador: 'F' | 'S' | null;
  saldoFinal: number | null;
}

/** Un día de caja cerrado (CAJ-06). */
export interface CierreCaja {
  id: number;
  fecha: string;
  /** Lo cerró Sistemas después de su día. */
  diaPendiente: boolean;
  diferencia: number;
  saldoFinal: number;
  usuario: string;
  fechaCierre: string;
}

/** GET /api/caja/corte: el cajero solo recibe el de hoy (como OTR-01). */
export interface CorteCajaRespuesta {
  fecha: string;
  hoy: string;
  puedeElegirFecha: boolean;
  corte: CorteCaja;
  /** null mientras el día siga abierto; si viene, el corte es el congelado al cerrar. */
  cierre: CierreCaja | null;
  /** El día ya pasó, tuvo movimientos y nadie lo cerró: solo Sistemas puede cerrarlo. */
  diaPendiente: boolean;
  /** El rol del usuario puede cerrar este día y el día no está cerrado. */
  puedeCerrar: boolean;
  /** Lo que hoy impide cerrarlo (turno abierto, día anterior pendiente, arranque sin capturar). */
  avisoCierre: string | null;
}

// ── Saldo de arranque (CAJ-06) ─────────────────────────────────────────────

export type SerieFolio = 'NOTA_VENTA' | 'TRASPASO_CAJA';

/** Último folio emitido de una serie de `FolioService`. */
export interface FolioArranque {
  serie: SerieFolio;
  ultimoFolio: number;
}

/** GET /api/caja/arranque. Sin arranque, `fecha` y `saldoBoveda` vienen en null. */
export interface ArranqueCaja {
  fecha: string | null;
  saldoBoveda: number | null;
  /** Sistemas ya lo capturó: no cambia más. */
  confirmado: boolean;
  usuarioCaptura: string | null;
  fechaCaptura: string | null;
  fechaUltimoCierre: string | null;
  folios: FolioArranque[];
  hoy: string;
  puedeCapturar: boolean;
}

/** PUT /api/caja/arranque: solo Sistemas y una sola vez por sucursal. */
export interface ArranqueCajaRequest {
  fecha: string;
  saldoBoveda: number;
  folios: FolioArranque[];
}
