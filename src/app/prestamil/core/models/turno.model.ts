export interface Turno {
  id: number;
  usuarioId?: number;
  nombreUsuario?: string;
  fechaInicio?: string; // ISO datetime
  fechaFin?: string | null;
  activo?: boolean;
}

export interface TurnoResponse extends Turno {}
