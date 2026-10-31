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
