import { TrustFlowError } from '../errors';

export interface PreparedTx {
  xdr: string;
  networkPassphrase: string;
  fee: string;
}
export interface SignedTx {
  xdr: string;
  signatures: string[];
}
export interface SubmittedTx {
  hash: string;
  /** Always `true`: a Horizon response with `successful: false` is thrown as a `SUBMISSION_ERROR`. */
  successful: boolean;
  ledger?: number;
}

/**
 * Structured failure detail attached as `cause` to the `TrustFlowError` thrown by
 * {@link submitTransaction} when Horizon rejects a transaction.
 */
export interface HorizonSubmissionErrorDetail {
  status: number;
  title?: string;
  detail?: string;
  /** Transaction-level result code, e.g. `tx_failed` or `tx_bad_seq`. */
  transactionCode?: string;
  /** Per-operation result codes, e.g. `op_underfunded`. */
  operationCodes: string[];
}

interface HorizonResponseBody {
  hash?: string;
  successful?: boolean;
  ledger?: number;
  title?: string;
  detail?: string;
  extras?: { result_codes?: { transaction?: string; operations?: string[] } };
}

function normaliseHorizonUrl(horizonUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(horizonUrl);
  } catch (e) {
    throw new TrustFlowError(`Invalid Horizon URL: ${horizonUrl}`, 'INVALID_CONFIG', e);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TrustFlowError(
      `Invalid Horizon URL: ${horizonUrl} (must be http or https)`,
      'INVALID_CONFIG',
    );
  }
  return horizonUrl.replace(/\/+$/, '');
}

/**
 * Submits a signed transaction XDR to Horizon. Every failure is thrown as a
 * `TrustFlowError`; Horizon rejections carry a {@link HorizonSubmissionErrorDetail} as `cause`.
 */
export async function submitTransaction(xdr: string, horizonUrl: string): Promise<SubmittedTx> {
  const baseUrl = normaliseHorizonUrl(horizonUrl);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `tx=${encodeURIComponent(xdr)}`,
    });
  } catch (e) {
    throw TrustFlowError.wrap(e, 'CONNECTION_ERROR');
  }

  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    throw new TrustFlowError(
      `Failed to read Horizon response (HTTP ${res.status})`,
      'CONNECTION_ERROR',
      e,
    );
  }

  let data: HorizonResponseBody | undefined;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      data = parsed as HorizonResponseBody;
    }
  } catch {
    data = undefined;
  }

  if (!res.ok) {
    if (!data) {
      throw new TrustFlowError(
        `Transaction submission failed (HTTP ${res.status}): non-JSON response: ${text.slice(0, 200)}`,
        'SUBMISSION_ERROR',
        { status: res.status, operationCodes: [] } satisfies HorizonSubmissionErrorDetail,
      );
    }
    const detail: HorizonSubmissionErrorDetail = {
      status: res.status,
      title: data.title,
      detail: data.detail,
      transactionCode: data.extras?.result_codes?.transaction,
      operationCodes: data.extras?.result_codes?.operations ?? [],
    };
    const summary = detail.transactionCode ?? detail.title ?? 'Submission failed';
    const ops = detail.operationCodes.length ? ` [${detail.operationCodes.join(', ')}]` : '';
    throw new TrustFlowError(`${summary}${ops} (HTTP ${res.status})`, 'SUBMISSION_ERROR', detail);
  }

  if (!data || typeof data.hash !== 'string' || data.successful === false) {
    throw new TrustFlowError(
      `Horizon returned an unexpected response for a successful submission (HTTP ${res.status})`,
      'SUBMISSION_ERROR',
      { status: res.status, operationCodes: [] } satisfies HorizonSubmissionErrorDetail,
    );
  }
  return { hash: data.hash, successful: true, ledger: data.ledger };
}
