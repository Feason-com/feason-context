import { CONTEXT_DEFAULT_BASE_URL, contextOperations, type ContextOperationName } from './generated.js';

export { CONTEXT_CONTRACT_VERSION, contextOperations } from './generated.js';

export type SearchMode = 'lexical' | 'semantic' | 'hybrid';
export type SourceType = 'scripture' | 'creed' | 'council' | 'patristic' | 'historical' | 'confession' | 'lexicon';
export type VerificationStatus = 'unverified' | 'machine_checked' | 'curated' | 'scholarly_reviewed';

export interface FeasonContextClientOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

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

export class FeasonContextClient {
  private readonly baseUrl: string;
  private readonly request: typeof globalThis.fetch;
  private readonly token: string;

  constructor(options: FeasonContextClientOptions) {
    if (!options.token.trim()) throw new TypeError('Feason Context token is required');
    this.token = options.token;
    this.baseUrl = (options.baseUrl ?? CONTEXT_DEFAULT_BASE_URL).replace(/\/$/, '');
    this.request = options.fetch ?? globalThis.fetch;
  }

  manifest(): Promise<CorpusManifest> {
    return this.call<CorpusManifest>('manifest');
  }

  contextualize(input: { query: string; traditions?: string[]; maxTokens?: number; maxSources?: number }): Promise<ContextPackage> {
    return this.call<ContextPackage>('contextualize', input);
  }

  evaluateClaim(input: { claim: string; limitPerStance?: number }): Promise<ClaimEvaluation> {
    return this.call<ClaimEvaluation>('evaluateClaim', input);
  }

  search(input: { query: string; mode?: SearchMode; filters?: SourceFilters; limit?: number; cursor?: string }): Promise<SearchResponse> {
    return this.call<SearchResponse>('search', input);
  }

  evidencePacket(input: { question: string; traditions?: string[]; limit?: number }): Promise<EvidencePacket> {
    return this.call<EvidencePacket>('evidencePacket', input);
  }

  verifyCitation(input: { passageId: string; quote?: string; corpusVersion?: string }): Promise<CitationVerification> {
    return this.call<CitationVerification>('verifyCitation', input);
  }

  private async call<T>(operationName: ContextOperationName, body?: unknown): Promise<T> {
    const operation = contextOperations[operationName];
    const response = await this.request(`${this.baseUrl}${operation.path}`, {
      method: operation.method,
      headers: { authorization: `Bearer ${this.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const payload = await response.json() as T;
    if (!response.ok) throw new FeasonContextError(response.status, payload);
    return payload;
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
