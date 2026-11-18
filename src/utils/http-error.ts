/**
 * Error HTTP con un `code` estable (contrato docs/API_ENDPOINTS.md del front).
 * La respuesta siempre tiene la forma: { code, message, details? }
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(msg = "Solicitud inválida", code = "VALIDATION", details?: unknown) {
    return new HttpError(400, code, msg, details);
  }
  static unauthorized(msg = "No autenticado", code = "UNAUTHORIZED") {
    return new HttpError(401, code, msg);
  }
  static forbidden(msg = "No autorizado", code = "FORBIDDEN") {
    return new HttpError(403, code, msg);
  }
  static notFound(msg = "Recurso no encontrado", code = "NOT_FOUND") {
    return new HttpError(404, code, msg);
  }
  static conflict(msg = "Conflicto", code = "CONFLICT") {
    return new HttpError(409, code, msg);
  }
}
