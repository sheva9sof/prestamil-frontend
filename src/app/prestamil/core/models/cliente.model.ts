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
  clave?: number;
  descripcion: string;
  kilataje?: number;
  contienePiedad?: boolean;
}
