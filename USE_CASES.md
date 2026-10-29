# Feason Context integration recipes

Choose an operation by the output your application needs. All calls require a
scoped `context:read` token. Keep it on your server, read it from the environment,
and retain the source licenses and caveats returned with the evidence.

| Application | Start with | Present to the user |
| --- | --- | --- |
| Source-grounded study assistant | `contextualize` with a token and source budget | Citation labels, missing traditions, truncation, and generated explanation labeled separately |
| Research or sermon-preparation notebook | `evidencePacket` / `evidence_packet` | Exact passages grouped by source category, provenance, and retrieval caveats |
| Searchable historical-source library | `search` with filters and cursor pagination | Edition, author, source URL, retrieval mode, and a bounded next-page action |
| Quotation review before publication | `verifyCitation` / `verify_citation` | Match kind, passage identity, corpus release, and any mismatch |
| Editorial claim review | `evaluateClaim` / `evaluate_claim` | Supporting, opposing, qualifying, contextual, and unclassified evidence separately |
| Inspectable claim-review record | `claimProof` / `claim_proof` | Graph, unmet obligations, validation, caveats, and unsigned integrity commitment |
| Comparison of named traditions | TypeScript `FeasonStudyClient.compareTraditions` | Positions, source-only coverage, missing passages, and absent traditions without filling gaps |

Claim proof checks the returned evidence structure and commitments; it does not
prove theological truth or independently authenticate sources. An unsigned proof
is distinct from the Signed Proof V2 API. Neither client wraps those separate
publishing routes.

## Give a study assistant a fixed evidence budget

After building and installing the TypeScript package locally:

```ts
import { FeasonContextClient } from '@feason/context';

const context = new FeasonContextClient({
  token: process.env.FEASON_CONTEXT_TOKEN!,
  timeoutMs: 20_000,
});
const result = await context.contextualize({
  query: 'How did early Christians describe grace?',
  maxTokens: 1_500,
  maxSources: 6,
});
console.log(result.context, result.citations);
console.log(result.coverage, result.usage.truncated, result.instructions);
```

Supply `result.context` as source material to your model. Preserve citation labels
and display coverage gaps next to its answer. `maxTokens` budgets retrieved
context; it is not a model output limit. No model invocation is included here.

## Add a next-page action to a research library

After installing the Python package from source:

```python
import os
from feason_context import FeasonContextClient

context = FeasonContextClient(os.environ["FEASON_CONTEXT_TOKEN"])
query = "grace"
filters = {"sourceTypes": ["patristic"]}
page = context.search(query, mode="lexical", filters=filters, limit=5)
print(page["results"], page["retrievalMetadata"])

# Fetch only when the user requests another page. Keep the query and filters.
next_cursor = page["page"]["nextCursor"]
if next_cursor is not None:
    next_page = context.search(
        query, mode="lexical", filters=filters, limit=5, cursor=next_cursor
    )
    print(next_page["results"])
```

Treat cursors as opaque values. Do not infer exhaustive corpus coverage from a
page, scrape every page automatically, or treat an empty result as contradiction.
`manifest` provides corpus counts and the active version for diagnostic context.

## Review quotations before exporting a study

```ts
import { FeasonStudyClient } from '@feason/context';

const study = await new FeasonStudyClient({ context }).study({
  question: 'How did early Christians describe grace?',
  limit: 6,
}, { signal: AbortSignal.timeout(60_000) });

for (const citation of study.citations) {
  console.log(citation.evidence.text, citation.evidence.provenance);
  console.log(citation.status, citation.verification?.matchKind);
}
console.log(study.coverage, study.caveats, study.verification.allVerified);
```

This extends the TypeScript `context` example above. One retrieval plus one check
per unique passage is required. Quote checks use the packet's corpus version;
`unavailable`, `not_verified`, and empty results never become a verified export.
The Python equivalent uses `evidence_packet` and `verify_citation`, passing the
returned passage ID, exact quote, and `retrievalMetadata.corpusVersion` explicitly.

## Handle integration failures

Both clients raise `FeasonContextError` with `status` and `payload` for HTTP
failures and malformed successful responses. A 2xx status on this exception means
the body was invalid JSON or was not an object. Structured JSON error payloads
are retained; other response bodies are replaced with a generic message.

For 401/403, check token expiry and scope. For 429, stop the current batch and
apply your application's bounded backoff policy. There are no automatic retries.
TypeScript supports a per-request deadline and caller cancellation; Python uses
a 30-second socket timeout. Network failures retain their transport error type.
The clients check the top-level response object but do not validate every field
at runtime. Preserve failed verification as a visible incomplete state.
