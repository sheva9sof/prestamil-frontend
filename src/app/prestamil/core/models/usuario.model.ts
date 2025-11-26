export interface Usuario {
  id?: number;
  nombre: string;
  apellidos?: string;
  nombreUsuario: string;
  estatus?: boolean;
  // no incluir password en las respuestas
  password?: string;
  idRol?: number; // id del rol asignado
  rolNombre?: string; // nombre del rol para mostrar
}

export interface UsuarioResponse extends Usuario {
  // campos adicionales que el backend pueda enviar
}
