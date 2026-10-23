// Response DTOs live in @flicktips/shared (packages/shared/src/api) so the API can adopt them too.
export type * from '@flicktips/shared';
export { ApiError, isApiError } from './core';
