import { z } from 'zod';

import { badRequest, HttpError } from './errors.js';

// The legacy 404 body of IndexController: {success: false, msg: 'Not found'}.
export const notFoundMsg = () => new HttpError(404, 'Not found');

// Entity ids in paths: anything but a positive integer is "Not found", like a missing row.
export const idParam = z.coerce.number().int().positive().max(2_147_483_647);

export function parseId(value: unknown): number {
  const res = idParam.safeParse(value);
  if (!res.success) throw notFoundMsg();
  return res.data;
}

// `$request->get('page') ?: 1`: missing, '' and '0' mean the default.
export const optionalPositiveInt = (max: number) =>
  z.preprocess(
    (v) => (v === undefined || v === '' || v === '0' ? undefined : v),
    z.coerce.number().int().positive().max(max).optional(),
  );

export function parseQuery<S extends z.ZodType>(schema: S, query: unknown): z.infer<S> {
  const res = schema.safeParse(query ?? {});
  if (!res.success) throw badRequest(res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
  return res.data;
}
