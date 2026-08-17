# Feason Context SDKs

Typed, dependency-free TypeScript and Python clients for the Feason Context REST API, plus its OpenAPI 3.1 contract.

Feason Context supplies source-grounded Christian research material with exact passages, provenance, stable citations, named tradition coverage, and explicit coverage boundaries. Applications decide how to use the returned evidence.

## Included

- `typescript/` — `@feason/context`
- `python/` — `feason-context`
- `openapi/feason-context-openapi.yaml` — the public REST contract
- `contract.json` — versioned endpoint metadata used to generate both clients

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

## Security

Do not place API tokens in source, examples, issues, or test fixtures. See `SECURITY.md` for private vulnerability reporting.

## License

MIT. See `LICENSE`.
