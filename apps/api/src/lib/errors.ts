// Errors carry the legacy JSON shape ({success: false, msg}) so the ported pages keep working.
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly body: Record<string, unknown> = { success: false, msg: message },
  ) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, 'authorization required');
export const notFound = (what = 'Not found') => new HttpError(404, what, { success: false, err: what });
export const badRequest = (msg: string) => new HttpError(400, msg);
