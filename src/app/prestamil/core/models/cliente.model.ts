export interface ClienteResponse {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  curp?: string;
  rfc?: string;
  activo: boolean;
}

export interface CatSubtipoPrendaResponse {
  idAtributo: number;
  idTipoPrenda: number;
  nombreAtributo: string;
}

export interface CatValorPrendaResponse {
  idValorAtributo: number;
  clave?: number;
  descripcion: string;
  kilataje?: number;
  contienePiedad?: boolean;
}
