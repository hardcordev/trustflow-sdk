export type TrustFlowErrorCode =
  | 'CONNECTION_ERROR'
  | 'CONTRACT_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SIMULATION_ERROR'
  | 'SIGNING_ERROR'
  | 'INVALID_CONFIG'
  | 'NOT_CONNECTED'
  | 'BALANCE_FETCH_ERROR'
  | 'MULTISIG_ERROR'
  | 'MULTISIG_THRESHOLD_NOT_MET'
  | 'MULTISIG_ALREADY_SIGNED'
  | 'MULTISIG_EXPIRED'
  | 'MULTISIG_INVALID_SIGNER'
  | 'MULTISIG_XDR_ERROR'
  | 'ASSEMBLY_ERROR'
  | 'FEE_BUMP_ERROR'
  | 'SUBMISSION_ERROR'
  | 'RETRY_EXHAUSTED'
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'TIMEOUT'
  | 'INVALID_CONTRACT_CALL';

export class TrustFlowError extends Error {
  readonly code: TrustFlowErrorCode;
  readonly cause?: unknown;

  constructor(message: string, code: TrustFlowErrorCode, cause?: unknown) {
    super(message);
    this.name = 'TrustFlowError';
    this.code = code;
    this.cause = cause;
  }

  static wrap(error: unknown, code: TrustFlowErrorCode = 'CONTRACT_ERROR'): TrustFlowError {
    if (error instanceof TrustFlowError) {
      return error;
    }
    const message = error instanceof Error ? error.message : String(error);
    return new TrustFlowError(message, code, error);
  }

  static notFound(resource: string): TrustFlowError {
    return new TrustFlowError(`${resource} not found`, 'NOT_FOUND');
  }

  static unauthorized(action: string): TrustFlowError {
    return new TrustFlowError(`Unauthorized to perform: ${action}`, 'UNAUTHORIZED');
  }

  static validation(field: string, message: string): TrustFlowError {
    return new TrustFlowError(`Validation failed for ${field}: ${message}`, 'VALIDATION_ERROR');
  }

  static multiSigThresholdNotMet(collected: number, required: number): TrustFlowError {
    return new TrustFlowError(
      `Multi-sig threshold not met: ${collected}/${required} signatures collected`,
      'MULTISIG_THRESHOLD_NOT_MET',
    );
  }

  static multiSigExpired(operationId: string): TrustFlowError {
    return new TrustFlowError(`Multi-sig operation ${operationId} has expired`, 'MULTISIG_EXPIRED');
  }

  static multiSigInvalidSigner(address: string): TrustFlowError {
    return new TrustFlowError(
      `${address} is not an authorised signer for this operation`,
      'MULTISIG_INVALID_SIGNER',
    );
  }

  static multiSigXdrError(detail: string): TrustFlowError {
    return new TrustFlowError(`Multi-sig XDR error: ${detail}`, 'MULTISIG_XDR_ERROR');
  }

  static assemblyFailed(detail: string, cause?: unknown): TrustFlowError {
    return new TrustFlowError(`Transaction assembly failed: ${detail}`, 'ASSEMBLY_ERROR', cause);
  }

  static simulationFailed(detail: string, cause?: unknown): TrustFlowError {
    return new TrustFlowError(`Simulation failed: ${detail}`, 'SIMULATION_ERROR', cause);
  }

  static feeBumpFailed(detail: string, cause?: unknown): TrustFlowError {
    return new TrustFlowError(`Fee-bump construction failed: ${detail}`, 'FEE_BUMP_ERROR', cause);
  }

  static submissionFailed(detail: string, cause?: unknown): TrustFlowError {
    return new TrustFlowError(
      `Transaction submission failed: ${detail}`,
      'SUBMISSION_ERROR',
      cause,
    );
  }

  static signingFailed(detail: string, cause?: unknown): TrustFlowError {
    return new TrustFlowError(`Signing failed: ${detail}`, 'SIGNING_ERROR', cause);
  }

  static queueTimeout(timeoutMs: number): TrustFlowError {
    return new TrustFlowError(
      `Timed out after ${timeoutMs}ms waiting for earlier transactions from the same source account`,
      'TIMEOUT',
    );
  }

  static retryExhausted(stage: string, attempts: number, cause?: unknown): TrustFlowError {
    return new TrustFlowError(
      `Retries exhausted for ${stage} after ${attempts} attempt(s)`,
      'RETRY_EXHAUSTED',
      cause,
    );
  }
}
