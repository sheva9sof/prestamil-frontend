export interface DireccionResponse {
  id?: number;
  tipoDireccion: 'Fiscal' | 'Particular' | 'Laboral';
  calle: string;
  numeroExterior: string;
  numeroInterior?: string;
  colonia: string;
  ciudad: string;
  estado: string;
  codigoPostal: string;
  referencias?: string;
  esVerificada: boolean;
  fechaRegistro?: string;
}

export interface ClienteResponse {
  id: number;
  nombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  telefono: string;
  curp?: string;
  rfc?: string;
  activo: boolean;
  nombreCompleto: string;
  direccion?: DireccionResponse;
}

export interface CatSubtipoPrendaResponse {
  idAtributo: number;
  idTipoPrenda: number;
  nombreAtributo: string;
}

export interface CatValorPrendaResponse {
  idValorAtributo: number;
  idAtributo: number;
  nombreAtributo: string;
  idTipoPrenda: number;
  tipo: string;
  clave?: string;
  /** Nombre histórico del catálogo. Puede venir vacío: los ítems nuevos se identifican por clave. */
  descripcion?: string;
  kilataje?: number;
  contienePiedad?: boolean;
}
