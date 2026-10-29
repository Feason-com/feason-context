import { FeasonContextClient, type EvidenceItem, type EvidencePacket } from './index.js';

/** Synthetic transport demonstration. No Scripture or doctrinal assertions. */
export function fixtureEvidence(id: string, tradition: string): EvidenceItem {
  return {
    passageId: id, sourceId: `source-${id}`, sourceTitle: `Synthetic source ${id}`,
    author: 'Fixture author', sourceType: 'historical', tradition: [tradition],
    canonicalReference: `Fixture section ${id}`, text: `Synthetic demonstration text for ${id}.`,
    relationship: null, confidence: 0.5,
    provenance: {
      sourceUrl: `https://example.invalid/sources/${id}`, translation: null,
      translator: null, edition: 'Fixture edition', license: 'Synthetic fixture; not a licensed corpus source',
      licenseNotes: 'Only demonstrates SDK behavior.', verificationStatus: 'unverified',
    },
    retrieval: { score: 0.5, matchedBy: ['lexical'] },
  };
}

export function fixturePacket(): EvidencePacket {
  const a = fixtureEvidence('a', 'Fixture Tradition A');
  const b = fixtureEvidence('b', 'Fixture Tradition B');
  return {
    question: 'How are the fixture sources represented?',
    primarySources: [a, b], scripture: [], historicalContext: [a, b], patristicSources: [], councilSources: [],
    doctrinalConnections: [],
    interpretivePositions: [{
      positionId: 'fixture-position-a', topicSlug: 'fixture', tradition: 'Fixture Tradition A',
      summary: 'Synthetic source summary; not theological content.', sourcePassageIds: ['a'], confidence: 0.5,
      metadata: { caveat: 'A fixture does not establish the teaching of any real tradition.' },
    }],
    areasOfConsensus: [], areasOfDisagreement: [], relevantTerms: [],
    sourceProvenance: [a, b].map((item) => ({
      sourceId: item.sourceId, title: item.sourceTitle, sourceUrl: item.provenance.sourceUrl,
      license: item.provenance.license, verificationStatus: item.provenance.verificationStatus,
    })),
    retrievalMetadata: {
      mode: 'lexical', corpusVersion: 'synthetic-demo-v1', generatedAt: '2026-10-23T00:00:00Z',
      resultCount: 2, caveats: ['Synthetic fixtures only. No live retrieval, source authentication, or scholarly validation.'],
    },
    confidence: 0.5,
  };
}

export function createFixtureContext(): FeasonContextClient {
  const packet = fixturePacket();
  return new FeasonContextClient({
    token: 'synthetic-demo-token', baseUrl: 'https://example.invalid',
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path === '/api/context/v1/evidence-packet') {
        const input = JSON.parse(String(init?.body)) as { question: string; traditions?: string[] };
        // Mirror the production position filter's case-sensitive equality.
        const interpretivePositions = packet.interpretivePositions.filter((position) =>
          !input.traditions?.length || input.traditions.includes(position.tradition));
        return Response.json({ ...packet, question: input.question, interpretivePositions });
      }
      if (path === '/api/context/v1/verify-citation') {
        const input = JSON.parse(String(init?.body)) as { passageId: string; quote: string; corpusVersion: string };
        const item = packet.primarySources.find((source) => source.passageId === input.passageId);
        const verified = !!item && item.text === input.quote && input.corpusVersion === packet.retrievalMetadata.corpusVersion;
        return Response.json({
          verified, matchKind: verified ? 'exact_quote' : 'mismatch', passageId: input.passageId,
          sourceId: item?.sourceId, corpusVersion: packet.retrievalMetadata.corpusVersion,
          verificationPolicy: 'Synthetic fixture equality only; not production citation verification.',
        });
      }
      return Response.json({ error: 'Unknown fixture operation' }, { status: 404 });
    },
  });
}
