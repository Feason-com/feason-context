import { CONTEXT_DEFAULT_BASE_URL, contextOperations, type ContextOperationName } from './generated.js';

export { CONTEXT_CONTRACT_VERSION, contextOperations } from './generated.js';
export { FeasonStudyClient } from './study.js';
export type {
  FeasonStudyClientOptions, StudyContextClient, StudyInput, StudyResult, StudyCitation,
  StudyCoverage, TraditionComparison, TraditionPerspective,
} from './study.js';
export type { ScriptureProvider, ScriptureRequest, ScripturePassage } from './scripture.js';

export type SearchMode = 'lexical' | 'semantic' | 'hybrid';
export type SourceType = 'scripture' | 'creed' | 'council' | 'patristic' | 'historical' | 'confession' | 'lexicon';
export type VerificationStatus = 'unverified' | 'machine_checked' | 'curated' | 'scholarly_reviewed';

export interface FeasonContextClientOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  /** Per-request deadline, including the response body. Defaults to 20 seconds. */
  timeoutMs?: number;
}

export interface FeasonContextRequestOptions { signal?: AbortSignal }

export interface SourceFilters {
  sourceTypes?: SourceType[];
  traditions?: string[];
  authors?: string[];
  dateFrom?: number;
  dateTo?: number;
  verificationStatuses?: VerificationStatus[];
}

export interface CorpusManifest {
  corpusVersion: string;
  sourceCount: number;
  passageCount: number;
  entityCount: number;
  relationshipCount: number;
  traditionPositionCount: number;
  claimCount: number;
  verificationStatuses: Record<VerificationStatus, number>;
}

export interface EvidenceItem {
  passageId: string;
  sourceId: string;
  sourceTitle: string;
  author: string | null;
  sourceType: SourceType;
  tradition: string[];
  canonicalReference: string;
  text: string;
  relationship: string | null;
  confidence: number;
  provenance: {
    sourceUrl: string;
    translation: string | null;
    translator: string | null;
    edition: string | null;
    license: string;
    licenseNotes: string;
    verificationStatus: VerificationStatus;
  };
  retrieval: { score: number; matchedBy: Array<'lexical' | 'semantic' | 'ontology'> };
}

export interface TraditionPosition {
  positionId: string;
  topicSlug: string;
  tradition: string;
  summary: string;
  sourcePassageIds: string[];
  confidence: number;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  query: string;
  mode: SearchMode;
  filters: SourceFilters;
  results: EvidenceItem[];
  retrievalMetadata: {
    corpusVersion: string;
    resultCount: number;
    queryClassification: string;
    reranker: string;
    provenancePolicy: string;
  };
  page: { limit: number; offset: number; nextCursor: string | null };
}

export interface EvidencePacket {
  question: string;
  primarySources: EvidenceItem[];
  scripture: EvidenceItem[];
  historicalContext: EvidenceItem[];
  patristicSources: EvidenceItem[];
  councilSources: EvidenceItem[];
  doctrinalConnections: Array<{ concept: string; description: string; evidencePassageIds: string[] }>;
  interpretivePositions: TraditionPosition[];
  areasOfConsensus: string[];
  areasOfDisagreement: string[];
  relevantTerms: Array<{ term: string; description: string }>;
  sourceProvenance: Array<{ sourceId: string; title: string; sourceUrl: string; license: string; verificationStatus: VerificationStatus }>;
  retrievalMetadata: {
    mode: SearchMode;
    corpusVersion: string;
    generatedAt: string;
    resultCount: number;
    caveats: string[];
  };
  confidence: number;
}

export interface CitationVerification {
  verified: boolean;
  matchKind: 'passage_hash' | 'exact_quote' | 'normalized_quote' | 'mismatch';
  corpusVersion?: string;
  passageId: string;
  sourceId?: string;
  canonicalReference?: string;
  contentHash?: string;
  quoteOffset?: number | null;
  locator?: Record<string, unknown>;
  citation?: string | Record<string, unknown> | null;
  reason?: string;
  verificationPolicy: string;
}

export interface ContextCitation {
  label: string;
  passageId: string;
  sourceId: string;
  sourceTitle: string;
  canonicalReference: string;
  sourceUrl: string;
  traditions: string[];
  verificationStatus: VerificationStatus;
}

export interface ContextPackage {
  query: string;
  corpusVersion: string;
  context: string;
  citations: ContextCitation[];
  coverage: {
    requestedTraditions: string[];
    representedTraditions: string[];
    missingTraditions: string[];
    caveats: string[];
  };
  usage: {
    maxTokens: number;
    estimatedTokens: number;
    includedEvidence: number;
    availableEvidence: number;
    truncated: boolean;
  };
  instructions: string[];
}

export interface ClaimEvaluation {
  claim: string;
  normalizedClaim: string | null;
  claimDefinition: { label: string; description: string } | null;
  supportingEvidence: EvidenceItem[];
  contradictingEvidence: EvidenceItem[];
  qualifyingEvidence: EvidenceItem[];
  contextualEvidence: EvidenceItem[];
  unclassifiedEvidence: EvidenceItem[];
  confidence: number;
  methodology: string;
  negativeEvidencePolicy: string;
  caveats: string[];
}

export type ClaimProofStatus = 'corpus_supported' | 'corpus_supported_with_qualifications'
  | 'corpus_disputed' | 'corpus_opposed' | 'insufficient_evidence';

export interface ClaimProofArtifact {
  proofId: string;
  proofVersion: 'feason-claim-proof-v1';
  generatedAt: string;
  corpusVersion: string;
  claim: { submitted: string; normalizedSlug: string | null; label: string | null; description: string | null };
  graph: { nodes: Array<Record<string, unknown>>; edges: Array<Record<string, unknown>> };
  obligations: Array<{ obligationId: string; label: string; passed: boolean; detail: string }>;
  result: {
    status: ClaimProofStatus;
    label: string;
    explanation: string;
    confidence: number;
    evidenceCounts: Record<'supports' | 'opposes' | 'qualifies' | 'contextualizes', number>;
    representedTraditions: string[];
  };
  validation: { valid: boolean; meaning: string; checks: Array<{ checkId: string; label: string; passed: boolean; detail: string }> };
  methodology: string;
  caveats: string[];
  integrity: {
    scheme: 'sha256-merkle-v1';
    rootDigest: string;
    commitmentCount: number;
    commitments: Array<{ commitmentId: string; digest: string; inclusionPath: Array<{ position: 'left' | 'right'; digest: string }> }>;
    authenticity: 'unsigned';
    verifies: string;
    limitation: string;
  };
}

export class FeasonContextClient {
  private readonly baseUrl: string;
  private readonly request: typeof globalThis.fetch;
  private readonly token: string;
  private readonly timeoutMs: number;

  constructor(options: FeasonContextClientOptions) {
    if (!options.token.trim()) throw new TypeError('Feason Context token is required');
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? CONTEXT_DEFAULT_BASE_URL).replace(/\/$/, '');
    this.request = options.fetch ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 2_147_483_647) {
      throw new TypeError('timeoutMs must be an integer between 1 and 2147483647');
    }
  }

  manifest(options?: FeasonContextRequestOptions): Promise<CorpusManifest> {
    return this.call<CorpusManifest>('manifest', undefined, options);
  }

  contextualize(input: { query: string; traditions?: string[]; maxTokens?: number; maxSources?: number }, options?: FeasonContextRequestOptions): Promise<ContextPackage> {
    return this.call<ContextPackage>('contextualize', input, options);
  }

  evaluateClaim(input: { claim: string; limitPerStance?: number }, options?: FeasonContextRequestOptions): Promise<ClaimEvaluation> {
    return this.call<ClaimEvaluation>('evaluateClaim', input, options);
  }

  claimProof(input: { claim: string; limitPerStance?: number }, options?: FeasonContextRequestOptions): Promise<ClaimProofArtifact> {
    return this.call<ClaimProofArtifact>('claimProof', input, options);
  }

  search(input: { query: string; mode?: SearchMode; filters?: SourceFilters; limit?: number; cursor?: string }, options?: FeasonContextRequestOptions): Promise<SearchResponse> {
    return this.call<SearchResponse>('search', input, options);
  }

  evidencePacket(input: { question: string; traditions?: string[]; limit?: number }, options?: FeasonContextRequestOptions): Promise<EvidencePacket> {
    return this.call<EvidencePacket>('evidencePacket', input, options);
  }

  verifyCitation(input: { passageId: string; quote?: string; corpusVersion?: string }, options?: FeasonContextRequestOptions): Promise<CitationVerification> {
    return this.call<CitationVerification>('verifyCitation', input, options);
  }

  private async call<T>(operationName: ContextOperationName, body?: unknown, options?: FeasonContextRequestOptions): Promise<T> {
    const operation = contextOperations[operationName];
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new DOMException('Feason Context request timed out', 'TimeoutError')), this.timeoutMs);
    const cancel = () => deadline.abort(options?.signal?.reason);
    options?.signal?.addEventListener('abort', cancel, { once: true });
    if (options?.signal?.aborted) cancel();
    const signal = deadline.signal;
    try {
      signal.throwIfAborted();
      const response = await this.request(`${this.baseUrl}${operation.path}`, {
        method: operation.method,
        signal,
        headers: { authorization: `Bearer ${this.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch (error) {
        signal.throwIfAborted();
        if (!(error instanceof SyntaxError)) throw error;
        if (response.ok) throw new FeasonContextError(response.status, { error: 'The server returned an invalid JSON response' });
        payload = { error: 'The server returned a non-JSON error response' };
      }
      signal.throwIfAborted();
      if (!response.ok) throw new FeasonContextError(response.status, payload);
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new FeasonContextError(response.status, { error: 'The server returned a non-object JSON response' });
      }
      return payload as T;
    } finally {
      clearTimeout(timer);
      options?.signal?.removeEventListener('abort', cancel);
    }
  }
}

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
