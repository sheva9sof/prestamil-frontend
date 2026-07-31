/**
 * Modelos de la pantalla "Configuración del Oro" (tabla de 24 celdas kilataje x hechura).
 * Definidos de forma autocontenida (no se importan de plazo.model.ts) para que este
 * módulo no dependa de los tipos legacy que se limpian en el Plan 03.
 */

export interface OroCeldaResponse {
  kilataje: number;
  hechura: string; // 'F' | 'N' | 'E'
  hechuraDescripcion: string; // 'Fundir' | 'Normal' | 'Especial'
  precioAvaluo: number;
  porcPrestamo: number;
  precioPrestamo: number;
  editable: boolean; // false para 24K
}

export interface OroCeldaUpdateRequest {
  porcPrestamo: number;
}

export interface PrecioGramoResponse {
  id: number;
  sucursalId: number;
  precioGramo24k: number;
  calcularSobre: string;
  baseKilataje: number;
  factorFundir: number;
  factorNormal: number;
  factorEspecial: number;
  actualizadoEn?: string;
  actualizadoPor?: string;
}

export interface PrecioGramoRequest {
  precioGramoBase: number;
  factorFundir?: number;
  factorNormal?: number;
  factorEspecial?: number;
}
