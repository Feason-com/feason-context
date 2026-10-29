import { describe, expect, it, vi } from 'vitest';
import {
  FeasonContextError, FeasonStudyClient, type CitationVerification,
  type EvidencePacket, type ScripturePassage,
} from './index';
import { createFixtureContext, fixtureEvidence, fixturePacket } from './test-fixture';

function client(packet: EvidencePacket = fixturePacket()) {
  const evidencePacket = vi.fn(async () => packet);
  const verifyCitation = vi.fn(async (input: { passageId: string; quote?: string; corpusVersion?: string }): Promise<CitationVerification> => ({
    passageId: input.passageId, sourceId: `source-${input.passageId}`, corpusVersion: input.corpusVersion,
    verified: true, matchKind: 'exact_quote', verificationPolicy: 'Synthetic test verification',
  }));
  return { evidencePacket, verifyCitation };
}

describe('Feason study workflows', () => {
  it('matches mixed-case labels when the retrieval backend uses case-sensitive filtering', async () => {
    const context = createFixtureContext();
    const filtered = await context.evidencePacket({ question: 'Fixture sources', traditions: ['fixture tradition a'] });
    expect(filtered.interpretivePositions).toEqual([]);

    const result = await new FeasonStudyClient({ context }).compareTraditions({
      topic: 'Fixture sources',
      traditions: ['fixture tradition a', 'FIXTURE TRADITION B', 'Fixture Tradition C'],
    });
    expect(result.perspectives.map((item) => item.status)).toEqual([
      'positions_available', 'sources_only', 'not_represented',
    ]);
    expect(result.perspectives[0]!.positions[0]!.tradition).toBe('Fixture Tradition A');
    expect(result.coverage.missingTraditions).toEqual(['Fixture Tradition C']);
  });

  it('runs the whole workflow through the REST client and preserves all source categories', async () => {
    const result = await new FeasonStudyClient({ context: createFixtureContext() }).study({ question: 'Read fixture sources' });
    expect(result.verification).toMatchObject({ allVerified: true, counts: { verified: 2 } });
    expect(result.citations.map((item) => item.evidence.text)).toEqual(fixturePacket().primarySources.map((item) => item.text));
    expect(result.packet.historicalContext).toEqual(result.packet.primarySources);
    expect(result.caveats).toContain(fixturePacket().retrievalMetadata.caveats[0]);
  });

  it('deduplicates category overlap and verifies the exact quote against its release', async () => {
    const context = client();
    const packet = await context.evidencePacket();
    const result = await new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' });
    expect(result.packet).toBe(packet);
    expect(context.verifyCitation).toHaveBeenCalledTimes(2);
    expect(context.verifyCitation).toHaveBeenCalledWith({
      passageId: 'a', quote: packet.primarySources[0]!.text, corpusVersion: 'synthetic-demo-v1',
    }, {});
  });

  it('keeps requested order, deduplicates labels, and distinguishes missing positions from missing sources', async () => {
    const context = client();
    const result = await new FeasonStudyClient({ context }).compareTraditions({
      topic: 'Compare fixture sources', traditions: [' Fixture Tradition B ', 'Fixture Tradition A', 'Fixture Tradition C', 'fixture tradition b'],
    });
    expect(result.perspectives.map((item) => [item.tradition, item.status])).toEqual([
      ['Fixture Tradition B', 'sources_only'], ['Fixture Tradition A', 'positions_available'], ['Fixture Tradition C', 'not_represented'],
    ]);
    expect(result.coverage.missingTraditions).toEqual(['Fixture Tradition C']);
    expect(result.packet.areasOfDisagreement).toEqual([]);
    expect(result.packet.areasOfConsensus).toEqual([]);
    expect(context.evidencePacket).toHaveBeenCalledTimes(1);
  });

  it('discloses position citations absent from the retrieved evidence', async () => {
    const packet = fixturePacket();
    packet.interpretivePositions[0]!.sourcePassageIds.push('not-retrieved');
    const result = await new FeasonStudyClient({ context: client(packet) }).compareTraditions({
      topic: 'Compare fixture sources', traditions: ['Fixture Tradition A', 'Fixture Tradition B'],
    });
    expect(result.perspectives[0]!.missingPositionPassageIds).toEqual(['not-retrieved']);
  });

  it.each([
    { verified: false, matchKind: 'mismatch' },
    { passageId: 'other' }, { sourceId: 'other' }, { corpusVersion: 'other' }, { matchKind: 'passage_hash' },
  ])('does not certify a mismatched quote or identity: %j', async (override) => {
    const context = client();
    const verify = context.verifyCitation.getMockImplementation()!;
    context.verifyCitation.mockImplementation(async (input) => ({ ...await verify(input), ...override } as CitationVerification));
    const result = await new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' });
    expect(result.verification.allVerified).toBe(false);
    expect(result.citations.every((item) => item.status === 'not_verified')).toBe(true);
  });

  it('preserves normalized matches without presenting them as exact matches', async () => {
    const context = client();
    const verify = context.verifyCitation.getMockImplementation()!;
    context.verifyCitation.mockImplementation(async (input) => ({ ...await verify(input), matchKind: 'normalized_quote' }));
    const result = await new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' });
    expect(result.verification.allVerified).toBe(true);
    expect(result.citations[0]!.verification?.matchKind).toBe('normalized_quote');
  });

  it('keeps failed verification explicit and sanitizes provider exceptions', async () => {
    const context = client();
    context.verifyCitation.mockRejectedValue(new Error('upstream secret-token'));
    const result = await new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' });
    expect(result.verification.counts.unavailable).toBe(2);
    expect(result.verification.allVerified).toBe(false);
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it.each([401, 403, 429])('stops scheduling after HTTP %i rather than retrying', async (status) => {
    const context = client();
    context.verifyCitation.mockRejectedValue(new FeasonContextError(status, {}));
    const sdk = new FeasonStudyClient({ context, verificationConcurrency: 1 });
    await expect(sdk.study({ question: 'Read fixture sources' })).rejects.toMatchObject({ status });
    expect(context.verifyCitation).toHaveBeenCalledTimes(1);
  });

  it('respects bounded concurrency and keeps the original evidence order', async () => {
    const packet = fixturePacket();
    packet.primarySources = Array.from({ length: 9 }, (_, index) => fixtureEvidence(String(index), 'Fixture Tradition A'));
    packet.historicalContext = [];
    const context = client(packet);
    let active = 0;
    let peak = 0;
    const verify = context.verifyCitation.getMockImplementation()!;
    context.verifyCitation.mockImplementation(async (input) => {
      active += 1; peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, Number(input.passageId) % 2));
      active -= 1;
      return verify(input);
    });
    const result = await new FeasonStudyClient({ context, verificationConcurrency: 2 }).study({ question: 'Read fixture sources' });
    expect(peak).toBe(2);
    expect(result.citations.map((item) => item.evidence.passageId)).toEqual(packet.primarySources.map((item) => item.passageId));
  });

  it('propagates cancellation and makes no request for an already aborted study', async () => {
    const context = client();
    const controller = new AbortController();
    controller.abort();
    await expect(new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(context.evidencePacket).not.toHaveBeenCalled();
  });

  it('does not turn cancellation during verification into unavailable citations', async () => {
    const context = client();
    const controller = new AbortController();
    context.verifyCitation.mockImplementation(async () => { controller.abort(); throw controller.signal.reason; });
    await expect(new FeasonStudyClient({ context, verificationConcurrency: 1 }).study({ question: 'Read fixture sources' }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(context.verifyCitation).toHaveBeenCalledTimes(1);
  });

  it('supports explicit unverified retrieval without making verification calls', async () => {
    const context = client();
    const result = await new FeasonStudyClient({ context }).study({ question: 'Read fixture sources', verifyCitations: false });
    expect(result.verification).toMatchObject({ requested: false, allVerified: false, counts: { not_requested: 2 } });
    expect(context.verifyCitation).not.toHaveBeenCalled();
  });

  it('does not report an empty packet as verified or as negative evidence', async () => {
    const packet = fixturePacket();
    packet.primarySources = []; packet.historicalContext = [];
    const result = await new FeasonStudyClient({ context: client(packet) }).study({ question: 'Read fixture sources', traditions: ['Fixture Tradition A'] });
    expect(result.citations).toEqual([]);
    expect(result.verification.allVerified).toBe(false);
    expect(result.coverage.missingTraditions).toEqual(['Fixture Tradition A']);
    expect(result.caveats.join(' ')).toContain('no conclusion');
  });

  it('rejects conflicting duplicate passages before verification', async () => {
    const packet = fixturePacket();
    packet.historicalContext = [{ ...packet.primarySources[0]!, text: 'Conflicting text' }];
    const context = client(packet);
    await expect(new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' })).rejects.toThrow('conflicting copies');
    expect(context.verifyCitation).not.toHaveBeenCalled();
  });

  it('requires complete provenance before verification', async () => {
    const packet = fixturePacket();
    packet.primarySources[0]!.provenance.license = '';
    const context = client(packet);
    await expect(new FeasonStudyClient({ context }).study({ question: 'Read fixture sources' })).rejects.toThrow('attribution');
    expect(context.verifyCitation).not.toHaveBeenCalled();
  });

  it('validates input before making any request', async () => {
    const context = client();
    const sdk = new FeasonStudyClient({ context });
    await expect(sdk.study({ question: '  ' })).rejects.toThrow(TypeError);
    await expect(sdk.study({ question: 'Valid question', limit: 41 })).rejects.toThrow(TypeError);
    await expect(sdk.study({ question: 'Valid question', traditions: [''] })).rejects.toThrow(TypeError);
    await expect(sdk.compareTraditions({ topic: 'Valid question', traditions: ['Catholic', 'catholic'] })).rejects.toThrow(TypeError);
    expect(() => new FeasonStudyClient({ context, verificationConcurrency: 0 })).toThrow(TypeError);
    expect(context.evidencePacket).not.toHaveBeenCalled();
  });

  it('keeps optional Scripture text and attribution unchanged and separate from Feason', async () => {
    const context = client();
    const passage: ScripturePassage = {
      provider: 'Synthetic provider', reference: 'Fixture reference', text: '  Synthetic text\nwith original whitespace.  ',
      provenance: { sourceUrl: 'https://example.invalid', translation: 'Fixture', license: 'Fixture', attribution: 'Fixture attribution' },
    };
    const getPassage = vi.fn(async () => passage);
    const sdk = new FeasonStudyClient({ context, scripture: { getPassage } });
    const result = await sdk.getScripture({ reference: 'Fixture reference' });
    expect(result).toBe(passage);
    expect(context.evidencePacket).not.toHaveBeenCalled();
    expect(context.verifyCitation).not.toHaveBeenCalled();
    await expect(new FeasonStudyClient({ context }).getScripture({ reference: 'Fixture reference' })).rejects.toThrow('ScriptureProvider');
  });
});
