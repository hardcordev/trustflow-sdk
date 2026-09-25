import type { FeeBumpTransaction, Keypair, Memo, Transaction, xdr } from '@stellar/stellar-sdk';
import type { TrustFlowError } from '../errors';

/**
 * Discriminated result type returned by every pipeline stage. Mirrors the
 * SDK-wide `SDKResult<T>` convention, but carries a typed {@link TrustFlowError}
 * (with a stable `code`) instead of a bare string, so callers can branch on
 * failure cause programmatically rather than by parsing an error message.
 */
export type PipelineResult<T> = { ok: true; data: T } | { ok: false; error: TrustFlowError };

/**
 * Controls retry/backoff behaviour for a single pipeline stage
 * (simulate+assemble, or submit).
 */
export interface RetryPolicy {
  /** Maximum number of attempts, including the first. Defaults to 3. */
  maxAttempts?: number;
  /** Base delay in ms used for exponential backoff. Defaults to 300. */
  baseDelayMs?: number;
  /** Upper bound applied to any single backoff delay. Defaults to 5000. */
  maxDelayMs?: number;
}

/** Parameters required to assemble an unsigned transaction envelope. */
export interface AssembleParams {
  /** Public key (G...) of the account that will source and pay the base fee for the transaction. */
  sourceAccount: string;
  /** One or more operations to include, typically `contract.call(...)`. */
  operations: xdr.Operation[];
  /** Optional transaction memo. */
  memo?: Memo;
  /** Validity window, in seconds, from assembly time. Defaults to 30. */
  timeoutSeconds?: number;
  /** Base inclusion fee in stroops, before Soroban resource fees are added. Defaults to `BASE_FEE`. */
  fee?: string;
}

/** Options controlling how simulation results are folded back into a transaction. */
export interface PrepareOptions extends RetryPolicy {
  /**
   * Safety headroom applied on top of the RPC-reported `minResourceFee`, to
   * absorb small state changes between simulation and submission.
   * Defaults to 1.1 (10% headroom).
   */
  resourceFeeMultiplier?: number;
}

/** Configuration for escalating a submission into a fee-bumped transaction. */
export interface FeeBumpOptions {
  /** Keypair of the account that will pay the bumped fee and sign the fee-bump envelope. */
  feeSource: Keypair;
  /** Fee in stroops for the fee-bump envelope. Defaults to 10x `BASE_FEE`. */
  baseFee?: string;
}

/** Options controlling submission, on-chain confirmation polling, and fee-bump escalation. */
export interface SubmitOptions extends RetryPolicy {
  /** Interval between `getTransaction` polls while awaiting confirmation. Defaults to 1500ms. */
  pollIntervalMs?: number;
  /** Maximum number of confirmation polls before timing out. Defaults to 10. */
  pollAttempts?: number;
  /**
   * When the initial submission fails for a fee-related reason (the node
   * reports `TRY_AGAIN_LATER` or rejects the transaction for insufficient
   * fee), automatically build and resubmit a fee-bump transaction using
   * this configuration.
   */
  feeBump?: FeeBumpOptions;
}

/** Outcome of a successfully confirmed submission. */
export interface PipelineSubmission {
  /** Hex-encoded transaction hash. */
  hash: string;
  /** Ledger sequence the transaction was included in, if known. */
  ledger?: number;
  /** Whether the confirmed transaction was a fee-bump escalation. */
  feeBumped: boolean;
  /** Total submission attempts made before confirmation. */
  attempts: number;
  /** Final fee (stroops) charged on the confirmed transaction envelope. */
  feeCharged: string;
}

/** End-to-end parameters for {@link TransactionPipeline.run}. */
export interface RunPipelineParams extends AssembleParams {
  /** Keypair(s) that must sign the assembled inner transaction. */
  signers: Keypair[];
  /** Options for the simulate+assemble stage. */
  prepare?: PrepareOptions;
  /** Options for the submit+confirm stage, including fee-bump escalation. */
  submit?: SubmitOptions;
  /**
   * Wait for earlier `run()` calls with the same source account (on the same
   * network, across all pipeline instances in this process) to finish before
   * fetching a sequence number. Set to `false` to skip the queue. Defaults to `true`.
   */
  serialize?: boolean;
  /**
   * Maximum time in ms to wait behind earlier runs before failing with a
   * `TIMEOUT` error. Waits indefinitely when omitted. Ignored when `serialize` is `false`.
   */
  queueTimeoutMs?: number;
}

/** Union of transaction types the pipeline can submit. */
export type SubmittableTransaction = Transaction | FeeBumpTransaction;
