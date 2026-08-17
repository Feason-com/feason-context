import { describe, expect, it, vi } from 'vitest';

import { FeasonContextClient, FeasonContextError } from './index';

describe('Feason Context TypeScript SDK', () => {
  it('sends scoped bearer requests and returns typed payloads', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ corpusVersion: 'theology-v7.0.0', sourceCount: 38 }), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
    const client = new FeasonContextClient({ token: 'token', baseUrl: 'https://example.test/', fetch: request as typeof fetch });
    await expect(client.manifest()).resolves.toMatchObject({ corpusVersion: 'theology-v7.0.0', sourceCount: 38 });
    expect(request).toHaveBeenCalledWith('https://example.test/api/context/v1/manifest', expect.objectContaining({
      method: 'GET', headers: expect.objectContaining({ authorization: 'Bearer token' }),
    }));
  });

  it('throws a typed error without exposing or persisting a token', async () => {
    const client = new FeasonContextClient({ token: 'secret', fetch: async () => new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json' },
    }) });
    await expect(client.manifest()).rejects.toMatchObject<Partial<FeasonContextError>>({ status: 401, name: 'FeasonContextError' });
  });

  it('sends a prompt-ready contextualize request', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      query: 'What is grace?', corpusVersion: 'theology-v7.0.0', context: '# Feason Context', citations: [],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = new FeasonContextClient({ token: 'token', baseUrl: 'https://example.test', fetch: request as typeof fetch });

    await client.contextualize({ query: 'What is grace?', maxTokens: 1_500 });

    expect(request).toHaveBeenCalledWith('https://example.test/api/context/v1/contextualize', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ query: 'What is grace?', maxTokens: 1_500 }),
    }));
  });

  it('sends a bounded claim evaluation request', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      claim: 'Baptism always saves.', normalizedClaim: 'baptismal-regeneration', confidence: 0.92,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = new FeasonContextClient({ token: 'token', baseUrl: 'https://example.test', fetch: request as typeof fetch });

    await client.evaluateClaim({ claim: 'Baptism always saves.', limitPerStance: 3 });

    expect(request).toHaveBeenCalledWith('https://example.test/api/context/v1/evaluate-claim', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ claim: 'Baptism always saves.', limitPerStance: 3 }),
    }));
  });
});
