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
  /** Clave estándar; puede repetirse entre prendas con distinta descripción o kilataje (D-09). */
  clave?: string;
  /** Descripción general estandarizada ("ESCLAVA 14K"). Obligatoria desde D-09. */
  descripcion?: string;
  kilataje?: number;
  contienePiedra?: boolean;
  /** La migración D-09 le puso clave o descripción provisional; Sistemas debe completarla. */
  pendienteRevision?: boolean;
}
