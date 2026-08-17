"""Typed, dependency-free client for the Feason Context REST interface."""

from __future__ import annotations

import json
from typing import Any, Literal, TypedDict, cast
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from ._generated import CONTEXT_DEFAULT_BASE_URL, OPERATIONS

SearchMode = Literal["lexical", "semantic", "hybrid"]
VerificationStatus = Literal["unverified", "machine_checked", "curated", "scholarly_reviewed"]


class CorpusManifest(TypedDict):
    corpusVersion: str
    sourceCount: int
    passageCount: int
    entityCount: int
    relationshipCount: int
    traditionPositionCount: int
    claimCount: int
    verificationStatuses: dict[str, int]


class EvidenceItem(TypedDict, total=False):
    passageId: str
    sourceId: str
    sourceTitle: str
    author: str | None
    sourceType: str
    tradition: list[str]
    canonicalReference: str
    text: str
    relationship: str | None
    confidence: float
    provenance: dict[str, Any]
    retrieval: dict[str, Any]


class SearchResponse(TypedDict, total=False):
    query: str
    mode: SearchMode
    filters: dict[str, Any]
    results: list[EvidenceItem]
    retrievalMetadata: dict[str, Any]
    page: dict[str, Any]


class EvidencePacket(TypedDict, total=False):
    question: str
    primarySources: list[EvidenceItem]
    scripture: list[EvidenceItem]
    historicalContext: list[EvidenceItem]
    patristicSources: list[EvidenceItem]
    councilSources: list[EvidenceItem]
    doctrinalConnections: list[dict[str, Any]]
    interpretivePositions: list[dict[str, Any]]
    areasOfConsensus: list[str]
    areasOfDisagreement: list[str]
    relevantTerms: list[dict[str, str]]
    sourceProvenance: list[dict[str, Any]]
    retrievalMetadata: dict[str, Any]
    confidence: float


class CitationVerification(TypedDict, total=False):
    verified: bool
    matchKind: Literal["passage_hash", "exact_quote", "normalized_quote", "mismatch"]
    corpusVersion: str
    passageId: str
    sourceId: str
    canonicalReference: str
    contentHash: str
    quoteOffset: int | None
    locator: dict[str, Any]
    citation: str | dict[str, Any] | None
    reason: str
    verificationPolicy: str


class ContextPackage(TypedDict, total=False):
    query: str
    corpusVersion: str
    context: str
    citations: list[dict[str, Any]]
    coverage: dict[str, Any]
    usage: dict[str, Any]
    instructions: list[str]


class ClaimEvaluation(TypedDict, total=False):
    claim: str
    normalizedClaim: str | None
    claimDefinition: dict[str, str] | None
    supportingEvidence: list[EvidenceItem]
    contradictingEvidence: list[EvidenceItem]
    qualifyingEvidence: list[EvidenceItem]
    contextualEvidence: list[EvidenceItem]
    unclassifiedEvidence: list[EvidenceItem]
    confidence: float
    methodology: str
    negativeEvidencePolicy: str
    caveats: list[str]


class FeasonContextError(RuntimeError):
    def __init__(self, status: int, payload: Any):
        super().__init__(f"Feason Context request failed with HTTP {status}")
        self.status = status
        self.payload = payload


class FeasonContextClient:
    def __init__(self, token: str, base_url: str = CONTEXT_DEFAULT_BASE_URL):
        if not token.strip():
            raise ValueError("Feason Context token is required")
        self._token = token
        self.base_url = base_url.rstrip("/")

    def manifest(self) -> CorpusManifest:
        return cast(CorpusManifest, self._call("manifest"))

    def contextualize(
        self,
        query: str,
        traditions: list[str] | None = None,
        max_tokens: int = 2_000,
        max_sources: int = 12,
    ) -> ContextPackage:
        return cast(ContextPackage, self._call("contextualize", {
            "query": query,
            "traditions": traditions or [],
            "maxTokens": max_tokens,
            "maxSources": max_sources,
        }))

    def evaluate_claim(self, claim: str, limit_per_stance: int = 5) -> ClaimEvaluation:
        return cast(ClaimEvaluation, self._call("evaluateClaim", {
            "claim": claim, "limitPerStance": limit_per_stance
        }))

    def search(
        self,
        query: str,
        mode: SearchMode = "hybrid",
        limit: int = 10,
        filters: dict[str, Any] | None = None,
        cursor: str | None = None,
    ) -> SearchResponse:
        payload: dict[str, Any] = {"query": query, "mode": mode, "limit": limit}
        if filters is not None:
            payload["filters"] = filters
        if cursor is not None:
            payload["cursor"] = cursor
        return cast(SearchResponse, self._call("search", payload))

    def evidence_packet(self, question: str, traditions: list[str] | None = None, limit: int = 20) -> EvidencePacket:
        return cast(EvidencePacket, self._call("evidencePacket", {
            "question": question, "traditions": traditions or [], "limit": limit
        }))

    def verify_citation(
        self,
        passage_id: str,
        quote: str | None = None,
        corpus_version: str | None = None,
    ) -> CitationVerification:
        payload: dict[str, Any] = {"passageId": passage_id}
        if quote is not None:
            payload["quote"] = quote
        if corpus_version is not None:
            payload["corpusVersion"] = corpus_version
        return cast(CitationVerification, self._call("verifyCitation", payload))

    def _call(self, operation_name: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        operation = OPERATIONS[operation_name]
        data = json.dumps(payload).encode("utf-8") if payload is not None else None
        headers = {"Authorization": f"Bearer {self._token}"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        request = Request(f"{self.base_url}{operation['path']}", data=data, headers=headers, method=operation["method"])
        try:
            with urlopen(request, timeout=30) as response:
                parsed = json.loads(response.read().decode("utf-8"))
                if not isinstance(parsed, dict):
                    raise FeasonContextError(response.status, parsed)
                return cast(dict[str, Any], parsed)
        except HTTPError as error:
            raw = error.read().decode("utf-8")
            try:
                parsed_error: Any = json.loads(raw)
            except json.JSONDecodeError:
                parsed_error = raw
            raise FeasonContextError(error.code, parsed_error) from error


__all__ = [
    "CitationVerification", "ClaimEvaluation", "ContextPackage", "CorpusManifest", "EvidenceItem", "EvidencePacket",
    "FeasonContextClient", "FeasonContextError", "SearchMode", "SearchResponse",
]
