export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }

  static badRequest(msg = "Solicitud inválida", details?: unknown) {
    return new HttpError(400, msg, details);
  }
  static unauthorized(msg = "No autenticado") {
    return new HttpError(401, msg);
  }
  static forbidden(msg = "No autorizado") {
    return new HttpError(403, msg);
  }
  static notFound(msg = "Recurso no encontrado") {
    return new HttpError(404, msg);
  }
  static conflict(msg = "Conflicto") {
    return new HttpError(409, msg);
  }
}
