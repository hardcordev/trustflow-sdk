import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
} from '@stellar/stellar-sdk';
import type { TrustFlowClient } from '../client';
import type { ContractCallResult } from '../types/contract';
import { TrustFlowError } from '../errors';

export type SignAndSubmitFn = (xdr: string) => Promise<string>;

export async function invokeContract(
  client: TrustFlowClient,
  method: string,
  args: unknown[],
  caller: string,
  signAndSubmit?: SignAndSubmitFn,
): Promise<ContractCallResult> {
  const server = client.getSorobanServer();
  const contract = new Contract(client.contractId);

  try {
    const account = await server.getAccount(caller);
    const operation = contract.call(method, ...(args as any[]));

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: client.getNetworkPassphrase(),
    })
      .addOperation(operation)
      .setTimeout(30)
      .build();

    const simulation = await server.simulateTransaction(tx);

    if (rpc.Api.isSimulationError(simulation)) {
      return {
        success: false,
        errorCode: undefined,
      };
    }

    if (!signAndSubmit) {
      return {
        success: true,
        returnValue: simulation.result?.retval,
        gasUsed: 0,
      };
    }

    const prepared = rpc.assembleTransaction(tx, simulation).build();
    const xdr = prepared.toXDR();
    const txHash = await signAndSubmit(xdr);

    return {
      success: true,
      txHash,
      returnValue: simulation.result?.retval,
      gasUsed: 0,
    };
  } catch (e) {
    if (e instanceof TrustFlowError) {
      return { success: false, errorCode: undefined };
    }
    return { success: false, errorCode: undefined };
  }
}
