# `feason-context`

Typed, dependency-free access to the Feason Context REST interface for Python
3.11+. Supply an OAuth access token or Feason MCP key with `context:read`.
Source version `0.4.0` is available in this checkout; registry publication is a
separate release step and has not been verified by this update.

## Install from a checkout

From the directory containing this README:

```sh
python3 -m pip install .
```

Keep tokens in your server environment, outside browser code and source control.

```python
import os
from feason_context import FeasonContextClient, FeasonContextError

context = FeasonContextClient(os.environ["FEASON_CONTEXT_TOKEN"])
try:
    result = context.contextualize(
        "How did early Christians describe grace?",
        max_tokens=1500,
        max_sources=6,
    )
except FeasonContextError as error:
    print(f"Context request failed (HTTP {error.status})")
else:
    print(result["context"], result["citations"], result["coverage"])
```

## Operations

| Method | Use |
| --- | --- |
| `manifest()` | Inspect the active corpus version and counts |
| `contextualize(query, ...)` | Retrieve a token-budgeted evidence block and citations |
| `evaluate_claim(claim, ...)` | Inspect evidence by curated stance |
| `claim_proof(claim, ...)` | Retrieve an unsigned proof graph and integrity commitment |
| `search(query, ...)` | Retrieve filtered, paginated source passages |
| `evidence_packet(question, ...)` | Retrieve grouped sources, positions, and caveats |
| `verify_citation(passage_id, ...)` | Check a quote or passage hash against a corpus release |

See [integration recipes](../USE_CASES.md) for search pagination, research
notebooks, study assistants, claim review, and release-pinned quotation checks.
TypeScript additionally has composed study and tradition-comparison helpers;
the Python client exposes the seven underlying REST operations.

## Failure handling

`FeasonContextError.status` retains the HTTP status. `payload` retains structured
JSON errors and uses a generic message for non-JSON bodies. Malformed JSON and
non-object successful responses also raise this error, with their original 2xx
status. The client checks the top-level response object, not every response field.
Network failures keep their transport exception type. Calls use a 30-second
socket timeout and are not retried automatically.

Tokens are never persisted or logged by the client. The package includes the
PEP 561 marker for inline types. Matching a quotation does not establish doctrine,
complete source coverage, or permission to redistribute the source text.
