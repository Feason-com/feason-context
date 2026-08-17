# `feason-context`

Typed, dependency-free access to the Feason Context REST interface for Python 3.11+. Supply an OAuth access token or Feason MCP key with `context:read`.

```python
import os
from feason_context import FeasonContextClient

context = FeasonContextClient(os.environ["FEASON_CONTEXT_TOKEN"])
result = context.search(
    "John of Damascus on the procession of the Holy Spirit",
    mode="hybrid",
    limit=8,
)
```

The client exposes `manifest`, `search`, `evidence_packet`, and `verify_citation`. It never stores or logs the supplied token.

Requires Python 3.11 or later. The package includes the PEP 561 marker for inline types and is released through PyPI Trusted Publishing.
