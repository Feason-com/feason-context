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

  it('passes the ordered batch to the additive endpoint and preserves each result', async () => {
    const payload = { citations: [{ passageId: 'fixture-a', quote: 'text a', corpusVersion: 'fixture-v1' }, { passageId: 'fixture-b' }] };
    const results = [
      { passageId: 'fixture-a', verified: true, matchKind: 'exact_quote', verificationPolicy: 'Synthetic' },
      { passageId: 'fixture-b', verified: false, matchKind: 'mismatch', verificationPolicy: 'Synthetic' },
    ];
    const request = vi.fn(async () => Response.json({ results }));
    const client = new FeasonContextClient({ token: 'token', baseUrl: 'https://example.test', fetch: request as typeof fetch });
    await expect(client.verifyCitationsBatch(payload)).resolves.toEqual({ results });
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('https://example.test/api/context/v1/verify-citations-batch', expect.objectContaining({
      method: 'POST', headers: expect.objectContaining({ authorization: 'Bearer token' }), body: JSON.stringify(payload),
    }));
  });

  it('rejects empty and oversized batches locally and missing results after one request', async () => {
    const request = vi.fn(async () => Response.json({ results: [] }));
    const client = new FeasonContextClient({ token: 'token', fetch: request as typeof fetch });
    await expect(client.verifyCitationsBatch({ citations: [] })).rejects.toThrow(TypeError);
    await expect(client.verifyCitationsBatch({ citations: Array.from({ length: 11 }, () => ({ passageId: 'fixture' })) })).rejects.toThrow(TypeError);
    expect(request).not.toHaveBeenCalled();
    await expect(client.verifyCitationsBatch({ citations: [{ passageId: 'fixture' }] })).rejects.toMatchObject({ status: 200 });
    expect(request).toHaveBeenCalledOnce();
  });

  it('rejects results ordered differently from their requests', async () => {
    const client = new FeasonContextClient({ token: 'synthetic', fetch: async () => Response.json({
      results: [{ passageId: 'b', verified: true }, { passageId: 'a', verified: true }],
    }) });
    await expect(client.verifyCitationsBatch({ citations: [{ passageId: 'a' }, { passageId: 'b' }] }))
      .rejects.toMatchObject({ status: 200 });
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

  it('requests a proof-carrying claim artifact', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({
      proofId: 'proof_abc', result: { status: 'corpus_supported' }, integrity: { rootDigest: '123' },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = new FeasonContextClient({ token: 'token', baseUrl: 'https://example.test', fetch: request as typeof fetch });

    await client.claimProof({ claim: 'The Son is fully divine', limitPerStance: 4 });

    expect(request).toHaveBeenCalledWith('https://example.test/api/context/v1/claim-proof', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ claim: 'The Son is fully divine', limitPerStance: 4 }),
    }));
  });

  it('keeps text-only HTTP failures typed without copying the raw response', async () => {
    const client = new FeasonContextClient({ token: 'secret', fetch: async () => new Response('upstream private diagnostic', { status: 429 }) });
    await expect(client.manifest()).rejects.toMatchObject({
      status: 429, payload: { error: 'The server returned a non-JSON error response' },
    });
  });

  it.each(['<html>upstream diagnostic</html>', '', '{broken'])('reports malformed successful JSON as a typed failure (%j)', async (body) => {
    const client = new FeasonContextClient({ token: 'secret', fetch: async () => new Response(body) });
    await expect(client.manifest()).rejects.toMatchObject({
      name: 'FeasonContextError', status: 200,
      payload: { error: 'The server returned an invalid JSON response' },
    });
  });

  it.each(['null', '[]', '"text"', '42', 'true'])('rejects non-object successful payloads (%s)', async (body) => {
    const client = new FeasonContextClient({ token: 'token', fetch: async () => new Response(body) });
    await expect(client.manifest()).rejects.toMatchObject({
      status: 200, payload: { error: 'The server returned a non-object JSON response' },
    });
  });

  it('preserves transport failures while reading a response', async () => {
    const failure = new TypeError('connection interrupted');
    const client = new FeasonContextClient({
      token: 'token', fetch: async () => new Response(new ReadableStream({ start(controller) { controller.error(failure); } })),
    });
    await expect(client.manifest()).rejects.toBe(failure);
  });

  it('preserves search filters and pagination and pins citation checks to a corpus release', async () => {
    const request = vi.fn(async () => Response.json({}));
    const client = new FeasonContextClient({ token: 'token', baseUrl: 'https://example.test', fetch: request });
    const search = { query: 'grace', mode: 'lexical' as const, filters: { sourceTypes: ['patristic' as const] }, limit: 5, cursor: 'opaque-cursor' };
    const citation = { passageId: 'fixture-passage', quote: 'Synthetic fixture text.', corpusVersion: 'fixture-v1' };
    await client.search(search);
    await client.verifyCitation(citation);
    expect(request).toHaveBeenNthCalledWith(1, 'https://example.test/api/context/v1/search', expect.objectContaining({ body: JSON.stringify(search) }));
    expect(request).toHaveBeenNthCalledWith(2, 'https://example.test/api/context/v1/verify-citation', expect.objectContaining({ body: JSON.stringify(citation) }));
  });

  it('passes cancellation to fetch and skips pre-aborted requests', async () => {
    const request = vi.fn(async () => Response.json({}));
    const client = new FeasonContextClient({ token: 'token', fetch: request });
    const controller = new AbortController();
    controller.abort();
    await expect(client.manifest({ signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(request).not.toHaveBeenCalled();
  });

  it('aborts stalled requests at the configured deadline', async () => {
    const client = new FeasonContextClient({
      token: 'token', timeoutMs: 10,
      fetch: (_url, init) => new Promise<Response>((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true });
      }),
    });
    await expect(client.manifest()).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('applies the deadline while reading the response body', async () => {
    const client = new FeasonContextClient({
      token: 'token', timeoutMs: 10,
      fetch: async (_url, init) => new Response(new ReadableStream({
        start(controller) {
          init!.signal!.addEventListener('abort', () => controller.error(init!.signal!.reason), { once: true });
        },
      })),
    });
    await expect(client.manifest()).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('rejects invalid deadlines', () => {
    expect(() => new FeasonContextClient({ token: 'token', timeoutMs: 0 })).toThrow(TypeError);
    expect(() => new FeasonContextClient({ token: 'token', timeoutMs: 2_147_483_648 })).toThrow(TypeError);
  });
});
