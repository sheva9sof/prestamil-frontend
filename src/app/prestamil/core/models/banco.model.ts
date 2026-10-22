/** Banco emisor para pagos con tarjeta en la ventana de Cobro (RN-24). */
export interface Banco {
  id: number;
  nombre: string;
  /** Un banco inactivo no aparece en la ventana de Cobro, pero conserva su historial. */
  activo: boolean;
}

export interface BancoRequest {
  nombre: string;
  activo?: boolean;
}
