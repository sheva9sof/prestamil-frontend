export interface PartidaContratoRequest {
  idTipoPrenda: number;
  idValorPrenda?: number;
  clavePrenda?: string;
  descripcion: string;
  cantidad?: number;
  pesoGramos?: number;
  kilataje?: number;
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
