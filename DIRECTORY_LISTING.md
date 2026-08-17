# Feason Context directory listing packet

This file is the source packet for MCP directories. Check every directory's current field limits and policies before submission.

## Core listing

- **Name:** Feason Context
- **Category:** Research, education, religion, source retrieval
- **Remote endpoint:** `https://www.feason.com/api/mcp`
- **Transport:** Streamable HTTP
- **Authentication:** OAuth 2.0 bearer tokens; discovery metadata is available from `https://www.feason.com/.well-known/oauth-protected-resource/api/mcp`
- **Developer documentation:** `https://www.feason.com/developers`
- **Quickstart:** `https://www.feason.com/developers/quickstart`
- **Repository and SDK source:** `https://github.com/Feason-com/feason-context`
- **Privacy:** `https://www.feason.com/privacy`
- **Terms:** `https://www.feason.com/terms`
- **Suggested tags:** christianity, theology, bible, research, citations, provenance, evidence, education

### Short description

Source-grounded Christian evidence for AI agents, with passage provenance, tradition attribution, coverage boundaries, and citation verification.

### Long description

Feason Context is a provider-neutral evidence layer for Christian research and AI applications. Its remote MCP server lets agents search source passages, inspect provenance, retrieve Scripture context and primary sources, compare attributed tradition positions, evaluate claims against retrieved material, build evidence packets, and verify exact citations. Responses preserve source identity and disclose corpus coverage; they do not present retrieval as a final theological or pastoral verdict.

## Representative capabilities

Public source-grounded tools include:

- `search_sources`
- `get_source`
- `resolve_citation`
- `verify_citation`
- `get_passage_context`
- `get_scripture_context`
- `get_primary_sources`
- `lookup_biblical_word`
- `compare_traditions`
- `evaluate_claim`
- `build_evidence_packet`

Authenticated users can also access private study, notes, reading-history, and research-project tools. Directory copy should distinguish these private tools from the public corpus layer and should never imply that Feason exposes one user's content to another user.

## Boundaries to preserve

- Feason returns evidence, provenance, coverage, and caveats. The calling application remains responsible for its final answer and user experience.
- An absent result is missing corpus coverage, not proof that a source or tradition has no position.
- Tradition comparisons are attributed descriptions, not a platform-wide declaration that one tradition is correct.
- Citation verification establishes text and source-release integrity; it does not prove an interpretation.
- Products using the service remain responsible for pastoral, medical, crisis, and other high-stakes safeguards.

## Directory-specific readiness

| Directory | Prepared artifact | Remaining external action |
| --- | --- | --- |
| Official MCP Registry | `server.json` | Validate, authenticate the Feason GitHub publisher, publish, and verify the registry record. |
| Smithery | `https://www.feason.com/.well-known/mcp/server-card.json` after the web change deploys | Sign in, import the remote server, review generated fields, and submit. |
| Glama | This repository and listing packet | Sign in, submit the repository/endpoint, and claim the server if requested. |
| PulseMCP | This listing packet | Use the current directory submission channel and confirm the final public listing. |
| faith.tools | This packet plus explicit corpus, licensing, and AI-boundary review | Review the current paid-submission terms before spending or submitting. |

Do not state that a directory accepted or listed Feason until its public record is independently verified.
