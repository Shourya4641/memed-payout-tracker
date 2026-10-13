/**
 * Domain error carrying the HTTP status and a stable machine-readable code.
 * Lives outside app.ts so that routes and middleware do not import the module
 * that imports them — the import graph stays acyclic.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}
