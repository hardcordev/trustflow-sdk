import { rpc, scValToNative } from '@stellar/stellar-sdk';
import type { TrustFlowClient } from '../client';
import { TrustFlowError } from '../errors';

export interface SimulationResult {
  success: boolean;
  cost: { cpuInsns: string; memBytes: string };
  returnValue?: unknown;
  error?: string;
}

interface FakeEnvelope {
  toXDR(): string;
}

export async function simulateContractCall(
  client: TrustFlowClient,
  xdr: string,
): Promise<SimulationResult> {
  const server = client.getSorobanServer();
  try {
    const result = await server.simulateTransaction({
      toEnvelope: () => ({ toXDR: () => xdr }) as FakeEnvelope,
    } as any);
    if (rpc.Api.isSimulationError(result)) {
      return { success: false, cost: { cpuInsns: '0', memBytes: '0' }, error: result.error };
    }
    // Decode the simulated return value the same way readContractState does,
    // so callers get a native JS value rather than a raw ScVal.
    const retval = (result as rpc.Api.SimulateTransactionSuccessResponse).result?.retval;
    return {
      success: true,
      cost: {
        cpuInsns: '0',
        memBytes: '0',
      },
      returnValue: retval ? scValToNative(retval) : undefined,
    };
  } catch (e) {
    throw new TrustFlowError('Simulation failed', 'SIMULATION_ERROR', e);
  }
}
