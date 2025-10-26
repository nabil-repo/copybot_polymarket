/**
 * Test script to create a Lit Protocol encrypted wallet
 * 
 * Usage:
 *   node scripts/create-lit-wallet.js
 * 
 * Requirements:
 *   - Backend server running on http://localhost:4000
 *   - User logged in (provide JWT token)
 */

import fetch from 'node-fetch';
import { ethers } from 'ethers';

const BACKEND_URL = 'http://localhost:4000';

async function main() {
  console.log('🔐 Creating Lit Protocol Encrypted Wallet\n');

  // Step 1: Login to get JWT token
  const email = process.argv[2] || 'test@example.com';
  const password = process.argv[3] || 'password123';

  console.log(`1️⃣ Logging in as ${email}...`);
  const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!loginResponse.ok) {
    console.error('❌ Login failed:', await loginResponse.text());
    process.exit(1);
  }

  const { token } = await loginResponse.json();
  console.log('✅ Logged in successfully\n');

  // Step 2: Create a test wallet to sign with
  console.log('2️⃣ Creating test wallet for signing...');
  const testWallet = ethers.Wallet.createRandom();
  console.log('📧 Test wallet address:', testWallet.address);

  // Step 3: Sign a message to create authSig
  console.log('\n3️⃣ Signing authentication message...');
  const message = 'Lit Protocol Access - Authorize wallet encryption';
  const signature = await testWallet.signMessage(message);

  const authSig = {
    sig: signature,
    derivedVia: 'web3.eth.personal.sign',
    signedMessage: message,
    address: testWallet.address
  };
  console.log('✅ Signature created');

  // Step 4: Define access control conditions
  console.log('\n4️⃣ Creating access control conditions...');
  const accessControlConditions = [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'ethereum',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: testWallet.address
      }
    }
  ];
  console.log('✅ Access control: Only wallet owner can decrypt');

  // Step 5: Call API to create encrypted wallet
  console.log('\n5️⃣ Creating encrypted wallet via Lit Protocol...');
  const createResponse = await fetch(`${BACKEND_URL}/api/user/lit-wallet/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ authSig, accessControlConditions })
  });

  if (!createResponse.ok) {
    const error = await createResponse.text();
    console.error('❌ Wallet creation failed:', error);
    process.exit(1);
  }

  const result = await createResponse.json();
  console.log('✅ Encrypted wallet created!');
  console.log('   Address:', result.address);
  console.log('   Message:', result.message);

  // Step 6: Verify wallet was stored
  console.log('\n6️⃣ Verifying encrypted wallet...');
  const getResponse = await fetch(`${BACKEND_URL}/api/user/lit-wallet`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  const walletInfo = await getResponse.json();
  console.log('✅ Wallet info:', walletInfo);

  console.log('\n🎉 Success! Encrypted wallet is ready for use.');
  console.log('\n📝 Next steps:');
  console.log('   1. Set USE_LIT=true in .env');
  console.log('   2. Start the bot');
  console.log('   3. Bot will use this wallet for copy trades');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
