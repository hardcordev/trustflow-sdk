# Changelog

## [Unreleased]
- Added a tag-triggered `release.yml` workflow (#305) that verifies, then publishes to npm with
  provenance and creates the GitHub Release; `scripts/verify-release.js` checks the tag,
  `package.json`, `SDK_VERSION`, the changelog heading and the `npm pack` file list. Documented in
  `docs/RELEASING.md`.
- Added an end-to-end suite (`npm run test:e2e`) and CI job that run against a local
  `stellar/quickstart` network (#306). `TrustFlowClient` and `TransactionPipeline` now honour the
  Stellar SDK's global `Config.setAllowHttp(true)` for plain-http RPC URLs.
- Added real React tests (jsdom and `@testing-library/react`) for `useWallet`, `useBalance`,
  `useTransaction` and `useEscrow`, run on React 18 and 19 in CI (#289).
- Added unit tests for `escrow/create.ts`, `cancel.ts` and `release.ts` validation and argument
  encoding (#276).
- Added `./escrow`, `./wallet`, and `./utils` subpath exports (#100) — the
  README's Quick Start (`import { createEscrow } from '@trustflow/sdk/escrow'`,
  and likewise `/wallet`, `/utils`) previously failed with
  `ERR_PACKAGE_PATH_NOT_EXPORTED` for consumers of the published package
  because only `.` and `./react` were declared. Each is wired into
  `tsup.config.ts`'s `entry` and `package.json`'s `exports` with matching
  `types` / `import` / `require` conditions, and a test asserts every
  `@trustflow/sdk/*` path in the README resolves against the exports map.
- Removed the dead duplicate `submitTransaction` in `src/stellar/horizon.ts`
  (#110) — the file was orphaned (not on the `src/stellar` barrel, no import
  sites; `MultiSigEscrowClient.submitWhenReady` uses the `(xdr, horizonUrl)`
  version from `src/stellar/transaction.ts`). A test guards against a second
  implementation reappearing.
- Exported `useEscrow` from `src/hooks/index.ts` (#107) — its
  `createEscrow` / `releaseEscrow` imports resolve against the real
  re-exports in `src/escrow/index.ts`, so the hook type-checks; added tests
  for its create / release success and error paths. Still ships only from the
  `@trustflow/sdk/react` subpath (#81).
- Added a Soroban RPC smoke test for the contract-invocation layer (#104) —
  `src/contract/{invoke,read,simulate}.ts` already use `rpc` (not the
  nonexistent `SorobanRpc`) against `@stellar/stellar-sdk@15`; the test
  constructs `rpc.Server` from `src/contract/index.ts`'s dependency graph so a
  future SDK bump breaking this is caught immediately.
- Added `TrustFlowEscrowClient.fund()` (#4) — funds an existing escrow by encoding a token
  transfer (e.g. the USDC Soroban token contract) into contract call arguments via the new
  `buildFundArgs`; omit `tokenAddress` to use the escrow's native asset.
- Added `ProfileClient` (#5) — type-safe Axios methods (`getProfile`/`updateProfile`) for the
  backend's `/profiles` endpoints, following the same retry-aware `SDKResult` pattern as
  `DisputeClient`/`JurorClient`. Exported from the package root alongside `Profile` and
  `UpdateProfileParams`.
- Added `disputeEscrow()` to `src/escrow/dispute.ts` (#6) — the on-chain counterpart to
  `DisputeClient.raiseDispute` (which posts to the backend API); simplifies the XDR construction
  for alerting the smart contract of a dispute via the existing `buildDisputeArgs`. This also
  fixes `examples/dispute.ts`, which already imported `disputeEscrow` from this module even
  though it was never implemented.
- Added a Typedoc configuration (#7) — `typedoc.json` plus `npm run docs` / `docs:watch` —
  auto-generating API reference HTML from JSDoc comments into `docs/reference` (gitignored,
  generated on demand). `skipErrorChecking` is enabled so doc generation isn't blocked by
  pre-existing unrelated compiler diagnostics in legacy browser-wallet code (`window` usage
  without a DOM lib, etc.).
- Exported the Zod validation schemas from `src/schemas.ts` (`StellarAddressSchema`,
  `ContractIdSchema`, `StroopsSchema`, `NetworkSchema`, `CreateEscrowSchema`,
  `ReleaseEscrowSchema`, `DisputeEscrowSchema`, `ClientConfigSchema`, plus the `*Input` inferred
  types) from the package root (#45) so consumers — notably frontend form validation — can reuse
  the same rules the SDK enforces internally instead of duplicating them. The schemas' inferred
  `Network` and `ClientConfig` type aliases are intentionally **not** re-exported from the root
  barrel: those names already exist as plain TS types in `src/types.ts`, and re-exporting both
  via `export *` produces an ambiguous-export error; import them directly from `../schemas` if
  needed. No new runtime dependency — `zod` was already added in #45.
- **Breaking changes: none.** Everything below is additive; existing `saveSession`/`loadSession`/
  `clearSession` and `MultiSigEscrowClient` call signatures are unchanged. See the "Compatibility
  & migration" note at the top of `docs/spikes/issue-79-retry-session-multisig.md`.
- Session storage (`auth/session.ts`) is now pluggable via a `SessionStorageAdapter` and
  `configureSessionStorage()`. Node/CLI/backend usage now defaults to an in-memory adapter
  instead of silently no-op'ing; browser usage is unchanged (`localStorage`). A pre-existing
  session with no stored expiry (written before this change, or by an older SDK version) is
  treated as not-yet-expired rather than retroactively expired.
- Sessions now carry an `expiresAt`, checked via the new `isSessionExpired()`. Best-effort only —
  the backend does not yet return a token TTL (tracked in #82) — see the README's "Session
  Storage" section. A malformed/corrupted stored `expiresAt` is treated as already expired rather
  than valid forever.
- Removed `src/stellar/rpc.ts` (`simulateAndAssemble`): dead code, never referenced or exported,
  fully superseded by `TransactionPipeline.prepare`. Not part of any documented public API
  (verified via repo-wide search of `src/`, `tests/`, `examples/`, and docs).
- Added `MultiSigStateStore` (target abstraction for a future backend-backed store, #83) and
  `MultiSigEscrowClient.exportState`/`importState` (non-breaking stopgap for coordinating signers
  across processes today) to `src/types/multisig.ts` / `src/escrow/multisig.ts`. Exported
  snapshots carry a `version` field (`MULTISIG_SNAPSHOT_VERSION`) so a future schema change can be
  detected and rejected by `importState` instead of silently misinterpreted.
- Retry: `src/utils/retry.ts` kept as-is (tested public utility); consolidating it with
  `TransactionPipeline`'s internal retry loop is tracked separately (#84).
- See `docs/spikes/issue-79-retry-session-multisig.md` for the full retry/session/multisig design
  writeup this release is based on. Follow-up implementation issues: #82, #83, #84.

## [0.2.1] - 2026-06-29
- Add shared backend API transport in `src/utils/http.ts` using `axios` + `axios-retry`
- Add automatic retries for transient backend failures (`429`, `5xx`, network errors)
- Migrate backend SDK endpoints from `fetch` to shared retry-aware transport:
	- `TrustFlowEscrowClient.getGigs`
	- `DisputeClient.raiseDispute` / `DisputeClient.getDispute`
	- `requestChallenge` / `verifyAndGetToken`
- Add Jest coverage for retry policy and backend transport behavior
- Add Jest tests validating contract argument XDR payload encoding
- Architectural decision: centralize backend HTTP behavior to avoid endpoint-specific retry drift

## [0.2.0] - 2026-04-28
- Add DisputeClient for dispute management
- Add EscrowMonitor for real-time event polling
- Add typed error classes and logger
- Add comprehensive test suite (10 files, 40+ tests)

## [0.1.0] - 2026-03-01
- Initial SDK release
- EscrowClient, EscrowBuilder, AuthSession
- Stellar network helpers and validators
