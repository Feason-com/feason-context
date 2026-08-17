# `@feason/context`

Typed, dependency-free access to the Feason Context REST interface. Supply an OAuth access token or Feason MCP key with `context:read`.

```ts
import { FeasonContextClient } from '@feason/context';

const context = new FeasonContextClient({ token: process.env.FEASON_CONTEXT_TOKEN! });
const result = await context.contextualize({
  query: 'How did early Christians describe the Holy Spirit?',
  traditions: ['orthodox', 'catholic'],
  maxTokens: 2_000,
});
```

The client exposes `manifest`, `contextualize`, `evaluateClaim`, `search`, `evidencePacket`, and `verifyCitation`. It never stores or logs the supplied token.

Requires Node.js 20 or later. Releases are generated from Feason’s checked contract and published with npm provenance.
