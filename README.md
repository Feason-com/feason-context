# Feason Context SDKs

Typed, dependency-free TypeScript and Python clients for the Feason Context REST API, plus its OpenAPI 3.1 contract.

Feason Context supplies source-grounded Christian research material with exact passages, provenance, stable citations, named tradition coverage, and explicit coverage boundaries. Applications decide how to use the returned evidence.

## Included

- `typescript/` — `@feason/context`
- `python/` — `feason-context`
- `openapi/feason-context-openapi.yaml` — the public REST contract
- `contract.json` — versioned endpoint metadata used to generate both clients
- `server.json` — official MCP Registry metadata for the hosted remote server
- `DIRECTORY_LISTING.md` — reusable, boundary-aware MCP directory copy
- `USE_CASES.md` — application recipes, operation selection, and response handling

Both clients expose seven REST operations: `manifest`, `contextualize`, claim
evaluation, claim proof, `search`, evidence packets, and citation verification.
The TypeScript SDK also composes them through `FeasonStudyClient.study` and
`compareTraditions`. These helpers preserve retrieved evidence and report
verification failures and missing tradition coverage explicitly.

The hosted service remains at `https://www.feason.com`. These clients do not contain the Feason corpus, production credentials, user data, retrieval engine, or server implementation. Tokens are accepted at runtime and are never persisted.

## TypeScript

```ts
import { FeasonContextClient } from "@feason/context";

const client = new FeasonContextClient({ token: process.env.FEASON_CONTEXT_TOKEN! });
const packet = await client.evidencePacket({ question: "How did early Christians describe grace?" });
console.log(packet);
```

## Python

```python
import os
from feason_context import FeasonContextClient

client = FeasonContextClient(os.environ["FEASON_CONTEXT_TOKEN"])
packet = client.evidence_packet("How did early Christians describe grace?")
print(packet)
```

## Development

```sh
node scripts/generate-clients.mjs --check
npm --prefix typescript install
npm --prefix typescript run build
npm --prefix typescript test
python3 -m unittest discover -s python -p 'test_*.py'
```

## Distribution

This checkout tracks SDK source version `0.4.0` and the canonical seven-operation
client contract. The OpenAPI document also describes separate Signed Proof V2
routes that these clients do not wrap. No package was published by this update,
and registry availability has not been verified. Build or pack the source locally;
see `PUBLISHING.md` for the release preflight and verification sequence.

The hosted MCP service is described separately by `server.json`. Directory descriptions should preserve Feason's evidence-layer boundaries; see `DIRECTORY_LISTING.md`.

## Security

Do not place API tokens in source, examples, issues, or test fixtures. See `SECURITY.md` for private vulnerability reporting.

## License

MIT. See `LICENSE`.
