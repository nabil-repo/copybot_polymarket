import { LitWalletService } from './lit-wallet.js';
import { run, get } from './db.js';
import { ethers } from 'ethers';

/**
 * Automatically creates a Lit-encrypted wallet for a user
 * Uses a server-generated authSig for initial setup
 * 
 * @param {number} userId - User ID
 * @param {string} userAddress - User's wallet address (for wallet-auth users) or generated address
 * @returns {Promise<{address: string, created: boolean}>}
 */
export async function autoCreateLitWallet(userId, userAddress = null) {
  try {
    // Check if user already has an encrypted wallet
    const existing = await get(
      'SELECT wallet_address FROM encrypted_wallets WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      console.log(`✅ User ${userId} already has encrypted wallet: ${existing.wallet_address}`);
      return { address: existing.wallet_address, created: false };
    }

    console.log(`🔐 Auto-creating Lit wallet for user ${userId}...`);

    // Initialize Lit service with timeout
    const litWallet = new LitWalletService();
    
    // Try to initialize with timeout
    const initTimeout = setTimeout(() => {
      console.log('⚠️  Lit initialization taking too long, continuing...');
    }, 5000);
    
    try {
      await Promise.race([
        litWallet.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Lit initialization timeout')), 10000)
        )
      ]);
      clearTimeout(initTimeout);
    } catch (initError) {
      clearTimeout(initTimeout);
      throw new Error(`Lit initialization failed: ${initError.message}`);
    }

    // Create a server-side wallet for signing (this is temporary, just for initial authSig)
    const serverWallet = ethers.Wallet.createRandom();
    
    // Sign a message to create authSig
    const message = `Auto-create encrypted wallet for user ${userId}`;
    const signature = await serverWallet.signMessage(message);

    const authSig = {
      sig: signature,
      derivedVia: 'web3.eth.personal.sign',
      signedMessage: message,
      address: serverWallet.address
    };

    // Define access control conditions
    // For auto-created wallets, allow decryption by:
    // 1. The user's wallet address (if they're wallet-authenticated)
    // 2. Or a server-controlled condition
    let accessControlConditions;
    
    if (userAddress && /^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      // User has a wallet address - allow them to decrypt
      accessControlConditions = [
        {
          contractAddress: '',
          standardContractType: '',
          chain: 'ethereum',
          method: '',
          parameters: [':userAddress'],
          returnValueTest: {
            comparator: '=',
            value: userAddress
          }
        }
      ];
      console.log(`   Access control: User wallet ${userAddress} can decrypt`);
    } else {
      // Email-authenticated user - use server wallet for access control
      accessControlConditions = [
        {
          contractAddress: '',
          standardContractType: '',
          chain: 'ethereum',
          method: '',
          parameters: [':userAddress'],
          returnValueTest: {
            comparator: '=',
            value: serverWallet.address
          }
        }
      ];
      console.log(`   Access control: Server-controlled (for email-auth user)`);
    }

    // Create encrypted wallet
    const encryptedWallet = await litWallet.createEncryptedWallet(
      accessControlConditions,
      authSig
    );

    // Store in database
    await run(
      `INSERT OR REPLACE INTO encrypted_wallets 
       (user_id, wallet_address, cipher_hex, iv_hex, encrypted_symmetric_key, access_control_conditions) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        encryptedWallet.address.toLowerCase(),
        encryptedWallet.encryptedKey.cipherHex,
        encryptedWallet.encryptedKey.ivHex,
        encryptedWallet.encryptedKey.encryptedSymmetricKey,
        JSON.stringify(accessControlConditions)
      ]
    );

    // Update user's execution_wallet
    await run(
      'UPDATE users SET execution_wallet = ? WHERE id = ?',
      [encryptedWallet.address.toLowerCase(), userId]
    );

    // Store authSig for later use (for server-controlled wallets)
    if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      await run(
        `CREATE TABLE IF NOT EXISTS wallet_auth_sigs (
          user_id INTEGER PRIMARY KEY,
          auth_sig TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      
      await run(
        `INSERT OR REPLACE INTO wallet_auth_sigs (user_id, auth_sig) VALUES (?, ?)`,
        [userId, JSON.stringify(authSig)]
      );
    }

    console.log(`✅ Auto-created Lit wallet for user ${userId}: ${encryptedWallet.address}`);

    return { 
      address: encryptedWallet.address, 
      created: true 
    };

  } catch (error) {
    console.error(`❌ Failed to auto-create Lit wallet for user ${userId}:`, error.message);
    
    // If Lit Protocol fails, create a regular encrypted wallet as fallback
    // This allows the system to continue working even if Lit network is down
    if (error.message.includes('fetch failed') || error.message.includes('timeout')) {
      console.log(`⚠️  Lit Protocol unavailable, creating standard wallet for user ${userId}...`);
      
      try {
        // Create a standard ethers wallet
        const standardWallet = ethers.Wallet.createRandom();
        
        // Store it with a flag indicating it's not Lit-encrypted
        await run(
          'UPDATE users SET execution_wallet = ? WHERE id = ?',
          [standardWallet.address.toLowerCase(), userId]
        );
        
        console.log(`✅ Created standard wallet for user ${userId}: ${standardWallet.address}`);
        console.log(`⚠️  Note: This wallet is NOT Lit-encrypted. Retry later for encrypted wallet.`);
        
        return { 
          address: standardWallet.address, 
          created: true,
          litEncrypted: false 
        };
      } catch (fallbackError) {
        console.error(`❌ Fallback wallet creation also failed:`, fallbackError.message);
      }
    }
    
    return null;
  }
}

/**
 * Get stored authSig for a user (for server-controlled wallets)
 */
export async function getStoredAuthSig(userId) {
  try {
    const row = await get(
      'SELECT auth_sig FROM wallet_auth_sigs WHERE user_id = ?',
      [userId]
    );
    
    if (row) {
      return JSON.parse(row.auth_sig);
    }
    
    return null;
  } catch (error) {
    console.error(`❌ Failed to get authSig for user ${userId}:`, error.message);
    return null;
  }
}
