/**
 * Identificador único (UUID v4) para la idempotencia de los cobros. No usa crypto.randomUUID():
 * solo existe en contextos seguros (HTTPS o localhost) y en sucursal se entra por IP y HTTP.
 * crypto.getRandomValues sí está disponible en cualquier contexto.
 */
export function generarRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // versión 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
