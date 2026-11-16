export const MAX_CITATION_VERIFICATION_BATCH = 10;

export class FeasonContextError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Feason Context request failed with HTTP ${status}`);
    this.name = 'FeasonContextError';
    this.status = status;
    this.payload = payload;
  }
}
