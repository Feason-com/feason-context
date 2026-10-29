# Package publishing runbook

The TypeScript and Python SDK source manifests both target version `0.4.0`. This source update does not publish either package. Registry availability has not been verified in this audit; installation examples must not claim a public release until publication is independently verified.

## Preflight

```sh
node scripts/generate-clients.mjs --check
npm --prefix typescript ci
npm --prefix typescript run build
npm --prefix typescript test
(cd typescript && npm pack --dry-run)
python3 -m unittest discover -s python -p 'test_*.py'
python3 -m build python --outdir python/dist
python3 -m twine check python/dist/*
```

Review both generated archives before publishing. They must contain the client code, type information, README, and license, and must not contain tokens, environment files, test credentials, or unrelated repository material.

## Publish TypeScript

Authenticate as an npm account permitted to publish the `@feason` scope, then run from the repository root:

```sh
(cd typescript && npm publish --access public --provenance)
```

Verify independently:

```sh
npm view @feason/context@0.4.0 version dist.integrity repository.url
```

## Publish Python

Authenticate using the approved PyPI project or trusted-publisher flow, then upload the already-reviewed artifacts:

```sh
python3 -m twine upload python/dist/*
```

Verify independently:

```sh
python3 -m pip index versions feason-context
```

## After both registries resolve

Only after the registry checks succeed:

1. Add public install commands to the root and language READMEs.
2. Create the matching GitHub release and tag.
3. Update Feason developer documentation with the verified versions.
4. Record the release evidence and package URLs.

Package publication is separate from publishing the remote MCP metadata in `server.json`.
