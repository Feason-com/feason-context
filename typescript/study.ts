import type {
  CitationVerification, EvidenceItem, EvidencePacket, FeasonContextClient,
  FeasonContextRequestOptions, TraditionPosition,
} from './index.js';
import type { ScripturePassage, ScriptureProvider, ScriptureRequest } from './scripture.js';

export type StudyContextClient = Pick<FeasonContextClient, 'evidencePacket' | 'verifyCitation'>;

export interface FeasonStudyClientOptions {
  context: StudyContextClient;
  scripture?: ScriptureProvider;
  /** Maximum simultaneous citation requests; 1–8, default 4. No retries. */
  verificationConcurrency?: number;
}

export interface StudyInput {
  question: string;
  /** Coverage/comparison labels, matched case-insensitively. No default tradition. */
  traditions?: string[];
  /** Retrieval limit, 3–40; default 12. */
  limit?: number;
  /** Defaults to true. False labels every citation as not_requested. */
  verifyCitations?: boolean;
}

export interface StudyCitation {
  /** Evidence is retained unchanged, including its edition and licensing. */
  evidence: EvidenceItem;
  status: 'verified' | 'not_verified' | 'unavailable' | 'not_requested';
  verification: CitationVerification | null;
  /** SDK reason, with no provider exception messages or credentials. */
  reason?: 'quote_or_identity_mismatch' | 'verification_unavailable';
}

export interface StudyCoverage {
  requestedTraditions: string[];
  /** Source labels indicate retrieval coverage, not doctrinal agreement. */
  representedTraditions: string[];
  missingTraditions: string[];
}

export interface StudyResult {
  /** Original server packet, including all categories, positions, and caveats. */
  packet: EvidencePacket;
  citations: StudyCitation[];
  coverage: StudyCoverage;
  verification: {
    requested: boolean;
    allVerified: boolean;
    counts: Record<StudyCitation['status'], number>;
  };
  caveats: string[];
}

export interface TraditionPerspective {
  tradition: string;
  /** These are corpus summaries, not universal statements about a tradition. */
  positions: TraditionPosition[];
  sourcePassageIds: string[];
  /** Position backing passages that were not retrieved in this packet. */
  missingPositionPassageIds: string[];
  status: 'positions_available' | 'sources_only' | 'not_represented';
}

export interface TraditionComparison extends StudyResult {
  perspectives: TraditionPerspective[];
}

const comparisonCaveat = 'Tradition labels describe the returned sources and positions; they do not establish agreement, disagreement, or complete coverage of a tradition.';
const verificationCaveat = 'Citation verification checks quotations against a corpus release; it does not certify theological truth, scholarly review, or permission to redistribute content.';

export class FeasonStudyClient {
  private readonly context: StudyContextClient;
  private readonly scriptureProvider?: ScriptureProvider;
  private readonly concurrency: number;

  constructor(options: FeasonStudyClientOptions) {
    this.context = options.context;
    this.scriptureProvider = options.scripture;
    this.concurrency = options.verificationConcurrency ?? 4;
    if (!Number.isInteger(this.concurrency) || this.concurrency < 1 || this.concurrency > 8) {
      throw new TypeError('verificationConcurrency must be an integer between 1 and 8');
    }
  }

  async study(input: StudyInput, options: FeasonContextRequestOptions = {}): Promise<StudyResult> {
    const question = input.question.trim();
    if (question.length < 3 || question.length > 4_000) {
      throw new TypeError('question must contain 3–4000 characters');
    }
    const traditions = traditionLabels(input.traditions ?? []);
    const limit = input.limit ?? 12;
    if (!Number.isInteger(limit) || limit < 3 || limit > 40) {
      throw new TypeError('limit must be an integer between 3 and 40');
    }
    options.signal?.throwIfAborted();
    // Retrieve all topic positions: the production API's tradition filter is
    // case-sensitive. Match requested labels locally without losing positions
    // or changing the original server packet and its corpus-wide caveats.
    const packet = await this.context.evidencePacket({ question, limit }, options);
    const evidence = collectEvidence(packet);
    const requested = input.verifyCitations !== false;
    const citations = await mapBounded(evidence, this.concurrency, async (item): Promise<StudyCitation> => {
      options.signal?.throwIfAborted();
      if (!requested) return { evidence: item, status: 'not_requested', verification: null };
      try {
        const verification = await this.context.verifyCitation({
          passageId: item.passageId, quote: item.text, corpusVersion: packet.retrievalMetadata.corpusVersion,
        }, options);
        options.signal?.throwIfAborted();
        const verified = verification.verified === true
          && verification.passageId === item.passageId
          && verification.sourceId === item.sourceId
          && verification.corpusVersion === packet.retrievalMetadata.corpusVersion
          && ['exact_quote', 'normalized_quote'].includes(verification.matchKind);
        return {
          evidence: item, status: verified ? 'verified' : 'not_verified', verification,
          ...(!verified ? { reason: 'quote_or_identity_mismatch' as const } : {}),
        };
      } catch (error) {
        options.signal?.throwIfAborted();
        // Authentication/authorization/rate-limit failures stop the workflow;
        // continuing would fan out requests that cannot succeed.
        // Other verification failures remain explicit, never repaired.
        if (error instanceof Error && 'status' in error && [401, 403, 429].includes(Number(error.status))) throw error;
        return { evidence: item, status: 'unavailable', verification: null, reason: 'verification_unavailable' };
      }
    });
    options.signal?.throwIfAborted();
    const counts: StudyResult['verification']['counts'] = { verified: 0, not_verified: 0, unavailable: 0, not_requested: 0 };
    for (const citation of citations) counts[citation.status] += 1;
    const representedTraditions = uniqueLabels(evidence.flatMap((item) => item.tradition));
    const coverage = {
      requestedTraditions: traditions,
      representedTraditions,
      missingTraditions: traditions.filter((name) => !representedTraditions.some((item) => sameLabel(item, name))),
    };
    return {
      packet, citations, coverage,
      verification: { requested, allVerified: citations.length > 0 && counts.verified === citations.length, counts },
      caveats: [...packet.retrievalMetadata.caveats, comparisonCaveat, verificationCaveat,
        ...(coverage.missingTraditions.length ? ['Missing traditions indicate retrieval or corpus coverage limits, not absence of teaching.'] : []),
        ...(!evidence.length ? ['No passage evidence was returned; no conclusion can be drawn from this packet.'] : []),
      ],
    };
  }

  async compareTraditions(
    input: Omit<StudyInput, 'question'> & { topic: string; traditions: string[] },
    options: FeasonContextRequestOptions = {},
  ): Promise<TraditionComparison> {
    const traditions = traditionLabels(input.traditions);
    if (traditions.length < 2) throw new TypeError('A comparison requires at least two distinct traditions');
    const study = await this.study({ ...input, question: input.topic, traditions }, options);
    const present = new Set(study.citations.map((item) => item.evidence.passageId));
    const perspectives = traditions.map((tradition): TraditionPerspective => {
      const positions = study.packet.interpretivePositions.filter((item) => sameLabel(item.tradition, tradition));
      const sources = study.citations.filter((item) => item.evidence.tradition.some((label) => sameLabel(label, tradition)));
      return {
        tradition, positions, sourcePassageIds: sources.map((item) => item.evidence.passageId),
        missingPositionPassageIds: [...new Set(positions.flatMap((item) => item.sourcePassageIds))].filter((id) => !present.has(id)),
        status: positions.length ? 'positions_available' : sources.length ? 'sources_only' : 'not_represented',
      };
    });
    return { ...study, perspectives };
  }

  /** Separate, explicit provider call. Never sent to Feason or a model. */
  async getScripture(input: ScriptureRequest, options: FeasonContextRequestOptions = {}): Promise<ScripturePassage> {
    if (!this.scriptureProvider) throw new TypeError('Configure a ScriptureProvider before calling getScripture');
    if (!input.reference.trim()) throw new TypeError('A Scripture reference is required');
    options.signal?.throwIfAborted();
    const passage = await this.scriptureProvider.getPassage(input, options);
    options.signal?.throwIfAborted();
    if (![passage.provider, passage.reference, passage.text, passage.provenance?.sourceUrl,
      passage.provenance?.translation, passage.provenance?.license, passage.provenance?.attribution]
      .every((value) => typeof value === 'string' && value.trim().length > 0)) {
      throw new TypeError('Scripture provider returned incomplete text or attribution');
    }
    return passage;
  }
}

function collectEvidence(packet: EvidencePacket): EvidenceItem[] {
  if (!packet.retrievalMetadata.corpusVersion.trim()) throw new TypeError('An evidence packet must identify its corpus release');
  const items = new Map<string, EvidenceItem>();
  for (const item of [...packet.primarySources, ...packet.scripture, ...packet.historicalContext,
    ...packet.patristicSources, ...packet.councilSources]) {
    if (![item.passageId, item.sourceId, item.sourceTitle, item.canonicalReference, item.text,
      item.provenance.sourceUrl, item.provenance.license].every((value) => value.trim().length > 0)) {
      throw new TypeError('Evidence must include text, stable identifiers, and source attribution');
    }
    const previous = items.get(item.passageId);
    if (previous && (previous.sourceId !== item.sourceId || previous.text !== item.text
      || previous.sourceTitle !== item.sourceTitle || previous.author !== item.author
      || previous.sourceType !== item.sourceType
      || JSON.stringify([...previous.tradition].sort()) !== JSON.stringify([...item.tradition].sort())
      || previous.canonicalReference !== item.canonicalReference
      || (Object.keys(previous.provenance) as Array<keyof EvidenceItem['provenance']>)
        .some((key) => previous.provenance[key] !== item.provenance[key]))) {
      throw new TypeError('An evidence packet contains conflicting copies of a passage');
    }
    if (!previous) items.set(item.passageId, item);
  }
  return [...items.values()];
}

function sameLabel(a: string, b: string): boolean { return a.toLowerCase() === b.toLowerCase(); }
function uniqueLabels(values: string[]): string[] {
  return values.filter((value, index) => values.findIndex((item) => sameLabel(item, value)) === index);
}
function traditionLabels(values: string[]): string[] {
  if (values.length > 10 || values.some((value) => !value.trim() || value.trim().length > 100)) {
    throw new TypeError('Provide at most 10 nonempty tradition labels of up to 100 characters');
  }
  return uniqueLabels(values.map((value) => value.trim()));
}

async function mapBounded<T, R>(values: T[], concurrency: number, map: (value: T) => Promise<R>): Promise<R[]> {
  const output = new Array<R>(values.length);
  let cursor = 0;
  let failed = false;
  let failure: unknown;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (!failed && cursor < values.length) {
      const index = cursor++;
      try {
        output[index] = await map(values[index]!);
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
  }));
  if (failed) throw failure;
  return output;
}
