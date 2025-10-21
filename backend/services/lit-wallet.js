import { EventEmitter } from 'events';
import { LitNodeClient } from '@lit-protocol/lit-node-client';
import { ethers } from 'ethers';

/**
 * Wallet management service using Lit Protocol for secure key management
 */
export class LitWalletService extends EventEmitter {
  constructor() {
    super();
    this.litNodeClient = null;
    this.authSig = null;
  }

  async initialize() {
    try {
      // Initialize Lit Protocol client
      this.litNodeClient = new LitNodeClient({
        litNetwork: 'cayenne', // or 'mainnet' for production
      });

      await this.litNodeClient.connect();
      console.log('✅ Lit Protocol connected');
    } catch (error) {
      console.log('❌ Failed to initialize Lit Protocol:', error);
      throw error;
    }
  }

  /**
   * Create encrypted wallet with Lit Protocol
   */
  async createEncryptedWallet(userId) {
    try {
      // Generate new wallet
      const wallet = ethers.Wallet.createRandom();

      // Define access control conditions
      const accessControlConditions = [
        {
          contractAddress: '',
          standardContractType: '',
          chain: 'ETH',
          method: '',
          parameters: [':userAddress'],
          returnValueTest: {
            comparator: '=',
            value: userId
          }
        }
      ];

      // Encrypt the private key
      const { ciphertext, dataToEncryptHash } = await this.litNodeClient.encrypt({
        accessControlConditions,
        dataToEncrypt: wallet.privateKey,
      });

      return {
        address: wallet.address,
        encryptedKey: {
          ciphertext,
          dataToEncryptHash
        },
        accessControlConditions
      };
    } catch (error) {
      console.log('Error creating encrypted wallet:', error);
      throw error;
    }
  }

  /**
   * Decrypt wallet private key
   */
  async decryptWallet(encryptedData, authSig) {
    try {
      const decryptedKey = await this.litNodeClient.decrypt({
        accessControlConditions: encryptedData.accessControlConditions,
        ciphertext: encryptedData.ciphertext,
        dataToEncryptHash: encryptedData.dataToEncryptHash,
        authSig,
      });

      return new ethers.Wallet(decryptedKey);
    } catch (error) {
      console.error('Error decrypting wallet:', error);
      throw error;
    }
  }

  /**
   * Sign transaction with encrypted wallet
   */
  async signTransaction(encryptedData, transaction, authSig) {
    try {
      const wallet = await this.decryptWallet(encryptedData, authSig);
      const signedTx = await wallet.signTransaction(transaction);
      return signedTx;
    } catch (error) {
      console.log('Error signing transaction:', error);
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(address, provider) {
    try {
      const balance = await provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.log('Error getting balance:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.litNodeClient) {
      await this.litNodeClient.disconnect();
    }
  }
}
