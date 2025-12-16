/**
 * Interfaces para la respuesta del login del backend
 */

export interface OpcionMenu {
  id: number;
  opcion: string;
  icono: string; // "true" o "false"
  nombreIcono: string | null;
  url: string | null;
  descripcion: string | null;
  submenus: OpcionMenu[];
}

export interface LoginResponse {
  nombreUsuario?: string; // Campo esperado del backend (opcional para compatibilidad)
  username?: string; // Campo alternativo del backend (opcional para compatibilidad)
  password: string | null;
  nombre: string;
  apellidos: string;
  estatus: boolean;
  cambiarPassword: boolean;
  ultimoLogin: string;
  idRol: number;
  fechaIni: string | null;
  fechaFin: string | null;
  vigencia: boolean;
  aplicaCambioPassword: boolean;
  fechaCambioPass: string;
  editable: boolean;
  sessionToken: string | null;
  ultimaActividad: string;
  inicioSesion: string;
  opciones: OpcionMenu[];
  token: string;
}

