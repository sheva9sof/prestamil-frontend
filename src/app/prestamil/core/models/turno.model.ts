export interface Turno {
  id: number;
  usuarioId?: number;
  nombreUsuario?: string;
  fechaInicio?: string; // ISO datetime
  fechaFin?: string | null;
  activo?: boolean;
}

export interface TurnoResponse extends Turno {}

/** GET /api/turnos/apertura: lo que impide abrir turno por el cierre de caja (CAJ-06); null si nada. */
export interface AperturaTurno {
  motivoBloqueo: string | null;
}
