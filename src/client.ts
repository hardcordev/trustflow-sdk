import { Config, Horizon, rpc, xdr } from '@stellar/stellar-sdk';
import {
  HORIZON_URLS,
  SOROBAN_RPC_URLS,
  NETWORK_PASSPHRASES,
  DEFAULT_NETWORK,
  SDK_VERSION,
} from './constants';
import { TrustFlowError } from './errors';
import type { Network, ClientConfig } from './types';
import { IPFSStorage } from './storage';
import { SimpleCache } from './utils/cache';

/** Default TTL for opt-in Horizon balance caching. */
export const DEFAULT_BALANCE_CACHE_TTL_MS = 5_000;

/** Controls cache behavior for a single balance lookup. */
export interface GetBalanceOptions {
  /** Fetch from Horizon even when a non-expired cached balance is available. */
  skipCache?: boolean;
}
import { createContractBinding, SorobanContractClient } from './contract';


/**
 * TrustFlowClient is the main entry point for interacting with the TrustFlow Protocol.
 * It handles network configuration, RPC connections, and provides access to escrow operations.
 */
export class TrustFlowClient {
  private server: Horizon.Server;
  private sorobanServer?: rpc.Server;
  private readonly balanceCache?: SimpleCache<string, string>;
  private _connected: boolean = false;

  readonly network: Network;
  readonly contractId: string;
  readonly rpcUrl: string;
  readonly apiBaseUrl?: string;
  readonly apiKey?: string;
  readonly version: string = SDK_VERSION;
  /** IPFS upload helper — `client.storage.upload(file)`. */
  readonly storage: IPFSStorage;

  /**
   * Creates a new TrustFlow client instance.
   *
   * @param config - Client configuration options
   * @param config.contractId - The Soroban contract ID for TrustFlow escrow
   * @param config.network - Network type ('TESTNET' or 'MAINNET'), defaults to TESTNET
   * @param config.rpcUrl - Optional custom Soroban RPC URL
   * @param config.apiBaseUrl - Optional TrustFlow API base URL for backend integration
   * @param config.apiKey - Optional API key for authenticated requests
   * @param config.ipfs - Optional configuration for the built-in `storage.upload()` IPFS helper
   *
   * @example
   * ```typescript
   * const client = new TrustFlowClient({
   *   contractId: process.env.CONTRACT_ID!,
   *   network: 'TESTNET',
   *   apiBaseUrl: 'https://api.trustflow.xyz',
   *   apiKey: process.env.API_KEY
   * });
   * await client.connect();
   *
   * const upload = await client.storage.upload(fileBuffer, { filename: 'contract.pdf' });
   * if (upload.ok) console.log('Uploaded:', upload.data.url);
   * ```
   */
  constructor(config: ClientConfig) {
    if (!config.contractId) {
      throw new TrustFlowError('contractId is required', 'INVALID_CONFIG');
    }

    this.network = config.network ?? DEFAULT_NETWORK;
    this.contractId = config.contractId;
    this.rpcUrl = config.rpcUrl ?? SOROBAN_RPC_URLS[this.network];
    this.apiBaseUrl = config.apiBaseUrl;
    this.apiKey = config.apiKey;
    this.storage = new IPFSStorage(config.ipfs);
    this.balanceCache = config.balanceCache
      ? new SimpleCache(config.balanceCache.ttlMs ?? DEFAULT_BALANCE_CACHE_TTL_MS)
      : undefined;

    this.server = new Horizon.Server(HORIZON_URLS[this.network]);
  }

  /**
   * Establishes connection to the Stellar network and verifies connectivity.
   * Must be called before performing any network operations.
   *
   * @throws {TrustFlowError} If connection to the network fails
   *
   * @example
   * ```typescript
   * await client.connect();
   * console.log('Connected to', client.network);
   * ```
   */
  async connect(): Promise<void> {
    try {
      // Test connection by fetching ledger info
      await this.server.ledgers().limit(1).call();
      this._connected = true;
    } catch (error) {
      this._connected = false;
      throw new TrustFlowError('Failed to connect to Stellar network', 'CONNECTION_ERROR', error);
    }
  }

  /**
   * Checks if the client is currently connected to the network.
   *
   * @returns true if connected, false otherwise
   */
  isConnected(): boolean {
    return this._connected;
  }

  /**
   * Retrieves the native XLM balance for a given Stellar address.
   *
   * @param address - Stellar public key (G... address)
   * @param options - Set `skipCache` to bypass a configured balance cache.
   * @returns Balance in XLM as a string
   * @throws {TrustFlowError} If the account doesn't exist or network error occurs
   *
   * @example
   * ```typescript
   * const balance = await client.getBalance('GDEPOSITOR...');
   * console.log(`Balance: ${balance} XLM`);
   *
   * // When `balanceCache` is configured, force a fresh Horizon lookup:
   * const freshBalance = await client.getBalance('GDEPOSITOR...', { skipCache: true });
   * ```
   */
  async getBalance(address: string, options: GetBalanceOptions = {}): Promise<string> {
    if (!options.skipCache) {
      const cachedBalance = this.balanceCache?.get(address);
      if (cachedBalance !== undefined) return cachedBalance;
    }

    try {
      const account = await this.server.loadAccount(address);
      const native = account.balances.find(
        (b: { asset_type: string }) => b.asset_type === 'native',
      );
      const balance = native?.balance ?? '0';
      this.balanceCache?.set(address, balance);
      return balance;
    } catch (error) {
      throw new TrustFlowError(
        `Failed to fetch balance for ${address}`,
        'BALANCE_FETCH_ERROR',
        error,
      );
    }
  }

  /**
   * Returns the underlying Horizon server instance for advanced operations.
   *
   * @returns Horizon.Server instance
   * @internal
   */
  getServer(): Horizon.Server {
    return this.server;
  }

  /**
   * Returns a shared Soroban RPC server instance, constructed on first use.
   *
   * Built from {@link rpcUrl}, which the constructor already defaults to
   * `SOROBAN_RPC_URLS[network]`, so a custom `rpcUrl` passed in `ClientConfig`
   * is honoured by every caller. The instance is cached, so contract calls
   * reuse one connection rather than building a throwaway server per call.
   * Plain-http URLs are refused unless the Stellar SDK's global
   * `Config.setAllowHttp(true)` is set (e.g. for a local quickstart node).
   *
   * @returns Cached rpc.Server instance for this client's network
   *
   * @example
   * ```typescript
   * const client = new TrustFlowClient({ network: 'testnet' });
   * const server = client.getSorobanServer();
   * const latest = await server.getLatestLedger();
   * ```
   */
  getSorobanServer(): rpc.Server {
    this.sorobanServer ??= new rpc.Server(this.rpcUrl, { allowHttp: Config.isAllowHttp() });
    return this.sorobanServer;
  }

  /**
   * Gets the network passphrase for transaction signing.
   *
   * @returns Network passphrase string
   */
  getNetworkPassphrase(): string {
    // Reads the same canonical source as HORIZON_URLS / SOROBAN_RPC_URLS
    // (NETWORK_CONFIGS via constants) rather than a third inline copy (#109).
    return NETWORK_PASSPHRASES[this.network];
  }

  /**
   * Creates authorization headers for API requests when apiKey is configured.
   *
   * @returns Headers object with authentication
   * @internal
   */
  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SDK-Version': this.version,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Verifies that the client is connected before performing operations.
   *
   * @throws {TrustFlowError} If not connected
   * @internal
   */
  ensureConnected(): void {
    if (!this._connected) {
      throw new TrustFlowError('Client is not connected. Call connect() first.', 'NOT_CONNECTED');
    }
  }

  /**
   * Generates auto-bound, type-safe contract client methods from Soroban spec entries.
   *
   * @param specEntries - Array of Soroban spec entries (XDR base64 strings, ScSpecEntry objects, or Buffers)
   * @param overrideContractId - Optional contract ID override (defaults to client's contractId)
   * @returns SorobanContractClient instance with bound spec methods
   *
   * @example
   * ```typescript
   * const binding = client.createContractBinding(specXdrEntries);
   * const res = await binding.methods.create_escrow({ depositor, beneficiary, amount, duration }, caller);
   * ```
   */
  createContractBinding<T extends Record<string, any> = Record<string, any>>(
    specEntries: (xdr.ScSpecEntry | string | Uint8Array | Buffer)[],
    overrideContractId?: string,
  ): SorobanContractClient & T & { methods: T } {
    return createContractBinding<T>(this, specEntries, overrideContractId);
  }

  /**
   * Returns a summary of the client configuration.
   *
   * @returns Object containing client configuration details
   */
  getConfig(): {
    network: Network;
    contractId: string;
    rpcUrl: string;
    apiConfigured: boolean;
    version: string;
  } {
    return {
      network: this.network,
      contractId: this.contractId,
      rpcUrl: this.rpcUrl,
      apiConfigured: Boolean(this.apiBaseUrl && this.apiKey),
      version: this.version,
    };
  }
}

