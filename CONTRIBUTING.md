# Contributing to TrustFlow SDK

## Setup
```bash
npm install
npm test
```

## Guidelines
- TypeScript strict mode — no `any` types in public APIs
- All public functions must have JSDoc comments
- Tests required for new utilities; coverage is enforced by `npm run test:coverage` (also run in CI on Node 22.x)
- Global coverage floor is set in `jest.config.js` (statements/lines 60%, functions 59%, branches 50%), just under the current baseline, so a PR that lowers coverage fails CI
- Ratchet plan: whoever lands tests that raise coverage (e.g. escrow, hooks, contract spec/bindings) raises the floor in the same PR, until the 60% target is met, then adds per-path thresholds for well-covered directories
- `npm run typecheck:tests` type-checks `tests/` (Jest transpiles with `isolatedModules` and does not type-check)
- Run `npm run lint` before submitting PR

## End-to-end tests
`npm test` never needs Docker or a network. The e2e suite (`tests/e2e/`) runs against a live Stellar network:

```bash
docker run --rm -d -p 8000:8000 --name stellar stellar/quickstart:latest --local
npm run test:e2e
docker stop stellar
```

The suite waits for Horizon, Soroban RPC (`getHealth`) and friendbot before starting, and funds its accounts through friendbot. Defaults match the quickstart container; override them to target another network (for example testnet):

| Variable | Default |
| --- | --- |
| `E2E_HORIZON_URL` | `http://localhost:8000` |
| `E2E_RPC_URL` | `http://localhost:8000/rpc` |
| `E2E_FRIENDBOT_URL` | `http://localhost:8000/friendbot` |
| `E2E_NETWORK_PASSPHRASE` | `Standalone Network ; February 2017` |

## Hook tests
Hook tests run under jsdom via `@testing-library/react`. CI runs them on React 18 and 19; locally, use `npm install --no-save react@19 react-dom@19 @types/react@19 @types/react-dom@19` to try React 19.

## Releasing
See [docs/RELEASING.md](docs/RELEASING.md).
