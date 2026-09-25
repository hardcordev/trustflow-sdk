# TrustFlow SDK API Reference

## TrustFlowClient

Main entry point for interacting with the TrustFlow Protocol. Manages network configuration, RPC connections, and provides access to escrow operations.

### Constructor

```typescript
new TrustFlowClient(config: ClientConfig)
```

**Parameters:**
- `contractId` — Soroban contract ID for TrustFlow escrow (required)
- `network` — Network type ('TESTNET' or 'MAINNET'), defaults to TESTNET
- `rpcUrl` — Optional custom Soroban RPC URL
- `apiBaseUrl` — Optional TrustFlow API base URL for backend integration
- `apiKey` — Optional API key for authenticated requests
- `ipfs` — Optional IPFS configuration for `storage.upload()`

### Methods

- `connect()` — Establishes connection to the Stellar network and verifies connectivity
- `isConnected()` — Returns true if currently connected to the network
- `getBalance(address)` — Retrieves native XLM balance for a given Stellar address
- `getNetworkPassphrase()` — Returns the network passphrase for transaction signing
- `getConfig()` — Returns a summary of the client configuration
- `getServer()` — Returns the underlying Horizon.Server instance for advanced operations
- `getAuthHeaders()` — Creates authorization headers for API requests when apiKey is configured

### Example

```typescript
const client = new TrustFlowClient({
  contractId: process.env.CONTRACT_ID!,
  network: 'TESTNET',
  apiBaseUrl: 'https://api.trustflow.xyz',
  apiKey: process.env.API_KEY
});
await client.connect();

const balance = await client.getBalance('GDEPOSITOR...');
console.log(`Balance: ${balance} XLM`);
```

## TrustFlowEscrowClient
- `createEscrow(params)` — create a new escrow; encodes contract call arguments via `buildCreateEscrowArgs`
- `fund(escrowId, funderAddress, amountStroops, tokenAddress?)` — transfer an asset (e.g. USDC via
  its Soroban token contract) into an existing escrow to be locked until release; encodes contract
  call arguments via `buildFundArgs`. Omit `tokenAddress` to use the escrow's native asset.
- `releaseEscrow(id, signer)` — release funds to beneficiary
- `claim(escrowId, claimantAddress)` — beneficiary-side shortcut to withdraw already-cleared escrow funds
- `getEscrow(id)` — read escrow state from contract
- `getGigs(params)` — fetch paginated gigs via backend API with automatic retries for transient failures (`429`, `5xx`, network)

## disputeEscrow (`src/escrow/dispute.ts`)
- `disputeEscrow(client, { escrowId, caller, reason })` — raises a dispute directly against the
  TrustFlow contract; encodes contract call arguments via `buildDisputeArgs`. Distinct from
  `DisputeClient.raiseDispute` below, which records the dispute with the backend API instead of
  the on-chain contract.

## MultiSigEscrowClient

Client for collecting M-of-N signatures on shared backend Escrow operations. Manages multi-signature workflows where multiple signers must authorize a transaction before it can be submitted.

### Constructor

```typescript
new MultiSigEscrowClient(config: ContractConfig)
```

### Flow

1. Call `initMultiSigOperation` with base unsigned XDR and signer list
2. Each authorized signer calls `addSignature` with their signed XDR
3. Poll `getMultiSigStatus` to check progress
4. Once `isReady` is true, call `submitWhenReady` to broadcast the transaction

### Methods

- `initMultiSigOperation(params)` — Initializes a new multi-sig operation for an escrow action
  - Returns `operationId` used to reference this operation in subsequent calls
  - Parameters: `escrowId`, `operationType`, `unsignedXdr`, `networkPassphrase`, `signers`, `threshold`, `expiresAt?`
  
- `addSignature(params)` — Adds a signer's contribution to a pending multi-sig operation
  - Extracts the `DecoratedSignature` from the provided XDR envelope
  - Merges it into the accumulated transaction without duplicating existing signatures
  - Parameters: `operationId`, `signerAddress`, `signedXdr`
  - Returns updated status snapshot after signature is recorded
  
- `getMultiSigStatus(operationId)` — Returns the current signature-collection status for an operation
  - Returns status including collected signatures, whether operation is ready, and expiry state
  
- `submitWhenReady(operationId, rpcClient)` — Submits the assembled transaction to Horizon once signature threshold is met
  - Only callable when `isReady` is true
  - Returns transaction hash on successful submission
  
- `getAssembledXdr(operationId)` — Assembles and returns the complete XDR with all collected signatures
  - Does not submit the transaction; useful for inspection or manual submission
  
- `listOperations()` — Returns all pending multi-sig operations

### Example

```typescript
const client = new MultiSigEscrowClient(config);

// Signer A initiates
const result = client.initMultiSigOperation({
  escrowId: 'escrow-123',
  operationType: 'release',
  unsignedXdr: '...',
  networkPassphrase: 'Test SDF Network ; September 2015',
  signers: ['GSIGNER_A...', 'GSIGNER_B...'],
  threshold: 2,
});
const { operationId } = result.data;

// Signer A adds their signature
client.addSignature({
  operationId,
  signerAddress: 'GSIGNER_A...',
  signedXdr: '...',
});

// Signer B adds their signature
client.addSignature({
  operationId,
  signerAddress: 'GSIGNER_B...',
  signedXdr: '...',
});

// Check status
const status = client.getMultiSigStatus(operationId);
if (status.data.isReady) {
  const submitResult = await client.submitWhenReady(operationId, rpcClient);
  console.log('Transaction hash:', submitResult.data.hash);
}
```

## ProfileClient
- `new ProfileClient(apiUrl, token, options?)`
- `.getProfile(address)` — fetch a user's profile (automatic retry on transient backend failures)
- `.updateProfile(address, params)` — update a user's profile (automatic retry on transient backend failures)

## IPFSStorage
- `new IPFSStorage(config?)` — `config.apiUrl` (default: web3.storage-compatible upload API), `config.apiKey`, `config.gatewayUrl`
- `.upload(file, options?)` — uploads a `Buffer`, `Uint8Array`, `ArrayBuffer`, `Blob` or browser `File` (a `File`'s `name` and a `Blob`'s `type` are used as the default `filename` / `contentType`); the request goes to `apiUrl` exactly as configured (no slash appended, query string kept); returns `SDKResult<{ cid, url }>`
- Also available as `client.storage.upload(file)` on `TrustFlowClient` (configure via `new TrustFlowClient({ ipfs: { apiKey } })`)

## Contract Bindings
- `client.createContractBinding(specEntries, contractId?)` — builds a spec-driven `SorobanContractClient` (`methods.*`, `read_*`, `simulate_*`); also `createContractBinding`, `SorobanSpec`, `AbstractContractClient` and `generateTypeScriptBindings` from the root entry
- See [CONTRACT_BINDINGS.md](./CONTRACT_BINDINGS.md) for obtaining spec entries, the JS-to-Soroban type-mapping table and known gaps

## EscrowBuilder
Fluent builder: `.setDepositor().setBeneficiary().setAmount().build()`

## EscrowMonitor
- `.on(event, handler)` — subscribe to escrow events
- `.startPolling(intervalMs, fetchFn)` — begin polling

## DisputeClient
- `.raiseDispute(params)` — raise a dispute (automatic retry on transient backend failures)
- `.getDispute(escrowId)` — get dispute status (automatic retry on transient backend failures)

## Auth
- `requestChallenge(apiUrl, address, options?)` — get signing challenge with retry-aware backend transport
- `verifyAndGetToken(apiUrl, address, signature, options?)` — exchange signature for JWT with retry-aware backend transport

## Wallet Module

Wallet integration utilities for connecting to Stellar wallets (Freighter and Albedo) and managing wallet connections.

### Exported Functions

- `connectWallet(walletType)` — Initiates connection to a specified wallet
  - `walletType`: 'freighter' | 'albedo'
  - Returns a `WalletConnection` with methods for signing and requesting payments
  
- `disconnectWallet()` — Disconnects from the currently connected wallet
  
- `getFreighter()` — Gets the Freighter wallet adapter if installed
  - Returns the Freighter API instance or throws if not available
  - Check with `isFreighterInstalled()` first
  
- `isFreighterInstalled()` — Checks whether Freighter browser extension is installed
  - Useful for conditional UI rendering
  
- `getAlbedo()` — Gets the Albedo wallet adapter
  - Initializes Albedo integration for web-based signing

### Types

- `WalletType` — 'freighter' | 'albedo'
- `WalletConnection` — Represents an active wallet connection with sign/payment methods
- `WalletAdapter` — Interface for wallet adapters

### Example

```typescript
import { connectWallet, disconnectWallet, isFreighterInstalled } from '@trustflow/sdk';

// Check if Freighter is available
if (isFreighterInstalled()) {
  const wallet = await connectWallet('freighter');
  const publicKey = await wallet.getPublicKey();
  console.log('Connected:', publicKey);
}

// Later: disconnect
await disconnectWallet();
```

## Event Parsing Utilities (`src/events.ts`)

Utilities for parsing raw Soroban contract events into typed TrustFlow event structures.

### Functions

- `isTrustFlowEvent(event, contractId)` — Checks whether a raw event belongs to TrustFlow
  - Validates that `event.contractId` matches the provided `contractId` and `event.type` is 'contract'
  
- `parseEvent(event)` — Parses a single raw Soroban contract event into a typed TrustFlow event
  - Returns `ParsedEvent` or `null` if parsing fails
  - Automatically decodes XDR-encoded values to readable strings
  - Handles multiple event types: `escrow_created`, `escrow_released`, `dispute_raised`, etc.
  
- `parseEvents(events, contractId)` — Parses an array of raw events, filtering and mapping to typed events
  - Filters to only TrustFlow events (via `isTrustFlowEvent`)
  - Maps each through `parseEvent`
  - Returns array of successfully-parsed events

### Types

- `TrustFlowEventType` — Union of event type strings: 'escrow_created' | 'escrow_released' | 'escrow_cancelled' | 'dispute_raised' | 'dispute_resolved' | 'milestone_completed'
- `ParsedEvent<T>` — Typed event with `type`, `contractId`, `ledger`, `timestamp`, `id`, `data`
- `EscrowCreatedData`, `EscrowReleasedData`, `DisputeRaisedData` — Event-specific data shapes

### Example

```typescript
import { parseEvents, isTrustFlowEvent } from '@trustflow/sdk';

// Fetch raw events from Horizon
const rawEvents = await horizon.effects().limit(10).call();

// Filter and parse
const trustFlowEvents = parseEvents(
  rawEvents.filter(e => e.type === 'contract'),
  'CBQHN7T6QV7YZXBEHNYQT4ZIXHQ7A4G26QCDHXN46WLZWURVSJR7D4E'
);

trustFlowEvents.forEach(event => {
  if (event.type === 'escrow_created') {
    const { escrowId, sender, recipient, amount } = event.data;
    console.log(`Escrow ${escrowId} created: ${sender} -> ${recipient} (${amount} stroops)`);
  }
});
```

## Validation Schemas
Zod runtime schemas (`src/schemas.ts`) — the same ones the SDK uses internally — exported from
the package root so frontend code can validate form/input data before calling the SDK, without
re-implementing the rules:

- `StellarAddressSchema`, `ContractIdSchema`, `StroopsSchema`, `NetworkSchema` — primitives
- `CreateEscrowSchema`, `ReleaseEscrowSchema`, `DisputeEscrowSchema` — escrow operation inputs
- `ClientConfigSchema` — `new TrustFlowClient(...)` config
- Inferred types `CreateEscrowInput`, `ReleaseEscrowInput`, `DisputeEscrowInput` are exported
  alongside their schemas. (`Network`/`ClientConfig` are not re-exported under those names from
  the root — they'd collide with the existing plain TS types of the same name; derive them
  yourself with `z.infer<typeof ClientConfigSchema>` / `z.infer<typeof NetworkSchema>` if needed.)

```typescript
import { CreateEscrowSchema } from '@trustflow/sdk';

const result = CreateEscrowSchema.safeParse(formValues);
if (!result.success) {
  showFormErrors(result.error.flatten());
}
```

## Backend API Retry Behavior
- Backend API endpoints now use a shared Axios transport configured with `axios-retry`.
- Default retry policy: 3 retries, exponential backoff (250ms base, 2000ms max cap).
- Retry conditions: network errors, HTTP `429`, and HTTP `5xx` responses.
- Non-transient `4xx` responses are returned without retry.

## TransactionPipeline
Unified pipeline for assembling, simulating, fee-adjusting, fee-bumping, and retrying
Soroban transactions against RPC. Every method returns a `PipelineResult<T>`
(`{ ok: true; data: T } | { ok: false; error: TrustFlowError }`) instead of throwing, so
callers get a typed, actionable `error.code` (e.g. `ASSEMBLY_ERROR`, `SIMULATION_ERROR`,
`FEE_BUMP_ERROR`, `SUBMISSION_ERROR`, `RETRY_EXHAUSTED`) without try/catch.

- `new TransactionPipeline(client: TrustFlowClient)`
- `.assemble(params)` — builds an unsigned transaction from a source account and operations
- `.simulate(tx)` — simulates a transaction against Soroban RPC without mutating it
- `.prepare(tx, options?)` — simulates and folds the footprint/auth/resource fee back onto
  the transaction, applying a configurable safety multiplier (`resourceFeeMultiplier`,
  default 1.1) on top of the RPC-reported `minResourceFee`; retries transient RPC failures
  with exponential backoff
- `.buildFeeBump(innerTx, { feeSource, baseFee? })` — wraps a transaction in a fee-bump
  envelope
- `.submit(tx, options?)` — broadcasts a signed transaction and polls for confirmation,
  retrying transient submission failures with exponential backoff
- `.run(params)` — convenience method chaining assemble → prepare → sign → submit; when
  submission fails for a fee-related reason (`TRY_AGAIN_LATER`, insufficient fee) and
  `submit.feeBump` is configured, automatically builds, signs, and resubmits a fee-bump
  transaction before giving up

```typescript
import { TransactionPipeline, TrustFlowClient } from '@trustflow/sdk';

const client = new TrustFlowClient({ contractId, network: 'TESTNET' });
const pipeline = new TransactionPipeline(client);

const result = await pipeline.run({
  sourceAccount: sender.publicKey(),
  operations: [contract.call('release', ...args)],
  signers: [sender],
  submit: { feeBump: { feeSource: sponsor } },
});

if (!result.ok) {
  console.error(result.error.code, result.error.message);
} else {
  console.log('confirmed:', result.data.hash, 'feeBumped:', result.data.feeBumped);
}
```

## Error Handling (`TrustFlowError` & `TrustFlowErrorCode`)

The SDK throws or returns `TrustFlowError` instances across operations (client instantiation, escrow operations, contract simulation, multi-sig operations, and wallet connections). Both `TrustFlowError` and its `TrustFlowErrorCode` type union are exported from the package root:

```typescript
import { TrustFlowClient, TrustFlowError, type TrustFlowErrorCode } from '@trustflow/sdk';

try {
  const client = new TrustFlowClient({ contractId: '' });
} catch (error) {
  if (error instanceof TrustFlowError) {
    console.error(`TrustFlow error [${error.code}]: ${error.message}`);
    if (error.code === 'INVALID_CONFIG') {
      // handle configuration error
    }
  }
}
```

### Error Codes (`TrustFlowErrorCode`)

| Error Code | Description |
|---|---|
| `CONNECTION_ERROR` | Network/RPC connection failure |
| `CONTRACT_ERROR` | Contract invocation error or contract failure |
| `VALIDATION_ERROR` | Input or schema validation failure |
| `UNAUTHORIZED` | Unauthorized action or missing wallet permissions |
| `NOT_FOUND` | Requested entity, escrow, or resource not found |
| `SIMULATION_ERROR` | Soroban transaction simulation failed |
| `SIGNING_ERROR` | Transaction signing failed |
| `INVALID_CONFIG` | Invalid or missing client configuration |
| `NOT_CONNECTED` | Operation attempted before client connected |
| `BALANCE_FETCH_ERROR` | Failed to query balance from Horizon/RPC |
| `MULTISIG_ERROR` | Generic multi-sig workflow error |
| `MULTISIG_THRESHOLD_NOT_MET` | Signatures collected is less than required threshold |
| `MULTISIG_ALREADY_SIGNED` | Signer has already signed this operation |
| `MULTISIG_EXPIRED` | Multi-sig operation expired |
| `MULTISIG_INVALID_SIGNER` | Address is not an authorized multi-sig signer |
| `MULTISIG_XDR_ERROR` | XDR serialization or decoding error during multi-sig operations |
| `ASSEMBLY_ERROR` | Soroban transaction assembly failure |
| `FEE_BUMP_ERROR` | Fee-bump transaction construction failure |
| `SUBMISSION_ERROR` | Transaction submission to RPC failed |
| `RETRY_EXHAUSTED` | Retry attempts exceeded for the operation |
| `NETWORK_ERROR` | Transport/network level error |
| `AUTH_ERROR` | Authentication challenge or verification failure |
| `TIMEOUT` | Operation timed out |

### Static Factory Methods

- `TrustFlowError.wrap(error: unknown, code?: TrustFlowErrorCode)`
- `TrustFlowError.notFound(resource: string)`
- `TrustFlowError.unauthorized(action: string)`
- `TrustFlowError.validation(field: string, message: string)`
- `TrustFlowError.multiSigThresholdNotMet(collected: number, required: number)`
- `TrustFlowError.multiSigExpired(operationId: string)`
- `TrustFlowError.multiSigInvalidSigner(address: string)`
- `TrustFlowError.multiSigXdrError(detail: string)`
- `TrustFlowError.assemblyFailed(detail: string, cause?: unknown)`
- `TrustFlowError.simulationFailed(detail: string, cause?: unknown)`
- `TrustFlowError.feeBumpFailed(detail: string, cause?: unknown)`
- `TrustFlowError.submissionFailed(detail: string, cause?: unknown)`
- `TrustFlowError.retryExhausted(stage: string, attempts: number, cause?: unknown)`
