# `@feason/context`

Source-grounded Christian research for developers. Retrieve exact passages with
provenance, compare explicitly named traditions, and check quotations against
a versioned corpus. No model, generated theological answer, or runtime dependency
is included. Requires Node.js 20 or later and a `context:read` OAuth token or
Feason MCP key for the hosted service.

The study workflows below are an **unreleased TypeScript addition**. Test the
checkout or a locally packed archive; do not assume an existing registry release
contains them. The Python client retains its existing REST operations.

## Build from source

These files track SDK source version `0.4.0`; that version is not a claim that a
registry release is available. From a checkout of the public SDK repository:

```sh
npm --prefix typescript ci
npm --prefix typescript run build
npm --prefix typescript test
```

See [use cases](../USE_CASES.md) for bounded search, citation review, and
application integration patterns.

## Build a study application

After installing a locally built package:

```ts
import { FeasonContextClient, FeasonStudyClient } from '@feason/context';

const context = new FeasonContextClient({
  token: process.env.FEASON_CONTEXT_TOKEN!,
  timeoutMs: 20_000,
});
const sdk = new FeasonStudyClient({ context });

const study = await sdk.study({
  question: 'How did early Christians describe grace?',
  limit: 12,
}, { signal: AbortSignal.timeout(60_000) });

for (const citation of study.citations) {
  console.log(citation.evidence.text); // Returned text remains unchanged.
  console.log(citation.evidence.provenance, citation.status);
}
console.log(study.coverage, study.verification, study.caveats);
```

The original `study.packet` retains all returned categories, relationships,
positions, confidence values, and server caveats. `study.citations` deduplicates
overlapping categories by passage ID and checks each exact returned quotation
against that packet's corpus release. Conflicting copies or missing required
attribution reject the workflow before verification.

Checks use at most four simultaneous requests by default; configure
`verificationConcurrency` between 1 and 8. With N unique passages, a study uses
one retrieval request plus N verification requests. There are no automatic
retries. Set `verifyCitations: false` for retrieval only; all citations are then
explicitly `not_requested` and `allVerified` is false.

## Compare traditions without filling coverage gaps

```ts
const comparison = await sdk.compareTraditions({
  topic: 'baptism',
  traditions: ['Catholic', 'Eastern Orthodox', 'Baptist'],
});

for (const perspective of comparison.perspectives) {
  console.log(perspective.tradition, perspective.status);
  console.log(perspective.positions, perspective.missingPositionPassageIds);
}
```

Supply corpus tradition labels explicitly; the SDK chooses no default tradition.
Labels are trimmed and deduplicated case-insensitively, without inferring aliases.
Retrieval omits the backend's case-sensitive tradition filter so differently
capitalized labels cannot discard available positions. Labels select coverage
and comparison views locally; the original packet retains all retrieved topic
positions. The result keeps the requested order and uses one shared packet:

- `positions_available`: the server returned an attributed position summary.
- `sources_only`: passage sources carry this label, with no returned position.
- `not_represented`: neither a position nor a labeled source was returned.

`coverage` describes **retrieved passage-source labels**, independently of
position availability or citation verification. A position may cite passages not
included in this retrieval; those IDs appear in `missingPositionPassageIds`.
Inspect that list and citation statuses before presenting a position as checked.
Consensus and disagreement remain exactly as supplied by the server and describe
all positions in the raw packet, rather than just the selected perspectives.
The SDK does not derive consensus for the selected subset. Missing sources never
become evidence against a doctrine or proof of consensus.

## Verification results

Each citation has a `status` and the original server `verification`, when present:

| Status | Meaning |
| --- | --- |
| `verified` | Quote matched the same passage, source, and corpus release |
| `not_verified` | Quote or identity did not satisfy those checks |
| `unavailable` | Verification could not complete; no match is inferred |
| `not_requested` | Caller explicitly skipped verification |

`exact_quote` and `normalized_quote` matches stay distinguishable in
`citation.verification.matchKind`. A passage-hash response alone does not verify
the submitted quotation. An empty result never has `allVerified: true`.

Cancellation propagates rather than becoming an unavailable citation. HTTP 401,
403, and 429 stop scheduling further checks and reject the study; already running
requests settle first. Other individual verification failures are marked
`unavailable`, without copying exception messages into the result. Retrieval
failures reject the study. Per-request deadlines include reading the body;
provide an overall `AbortSignal` to bound the complete workflow. A custom
injected client or fetch implementation must honor the supplied signal.

Matching a quotation does not establish doctrinal truth, scholarly review,
complete tradition coverage, or redistribution rights. Retain source license
and edition metadata and expose caveats in your application.

## Optional Scripture provider

Implement the exported `ScriptureProvider` interface using your application's
authorized Bible provider, then pass it as `scripture` when constructing
`FeasonStudyClient`. It has one method:

```ts
import type {
  FeasonContextRequestOptions, ScripturePassage, ScriptureRequest,
} from '@feason/context';

// Adapter signature; implementation belongs to the application.
type GetPassage = (
  input: ScriptureRequest,
  options?: FeasonContextRequestOptions,
) => Promise<ScripturePassage>;
```

Call `sdk.getScripture({ reference, translation })` explicitly. The adapter must
return exact text, provider name, reference, source URL, translation, license,
and attribution. The SDK returns it unchanged and keeps it separate from Feason
packets, citation verification, and model prompts. It does not supply provider
credentials or grant content rights. No YouVersion adapter is bundled; any
future integration must satisfy its API, content, AI, and commercial terms.

## Lower-level API

`FeasonContextClient` continues to expose `manifest`, `contextualize`,
`evaluateClaim`, `claimProof`, `search`, `evidencePacket`, and `verifyCitation`.
Each accepts an optional final `{ signal }` argument. HTTP errors and malformed successful responses use
`FeasonContextError` with `status` and `payload`; non-JSON bodies and successful
non-object payloads are replaced with a generic payload. A 2xx status on this
error means the response was malformed. Network failures retain their original
error type. The client checks that successful JSON is an object; it does not
validate every response field at runtime. Tokens are never persisted or logged by the SDK.
Keep tokens on your application server, outside browser bundles and source.

## Local packaging and validation

From the repository root:

```sh
npm run generate:check
npm --prefix typescript run build
npm --prefix typescript test
```

From `typescript`, run `npm pack`, then install the resulting archive into a
consumer project with `npm install /absolute/path/to/feason-context-0.4.0.tgz`.
The package exports the root API, `@feason/context/study`, and the type-only
`@feason/context/scripture` interface. Publication is separate from local packaging; follow [PUBLISHING.md](../PUBLISHING.md)
only when a release is approved.
