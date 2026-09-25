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
