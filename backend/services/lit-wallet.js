import { EventEmitter } from "events";
import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { webcrypto as crypto } from "crypto";
import { TextEncoder, TextDecoder } from "util";
import { ethers } from "ethers";

function bufToHex(buf) {
  return Buffer.from(buf).toString("hex");
}

function hexToBuf(hex) {
  return Buffer.from(hex, "hex");
}

async function importAesKey(raw) {
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export class LitWalletService extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.litNetwork = opts.litNetwork || process.env.LIT_NETWORK || "datil-dev";
    this.litClient = new LitNodeClient({ 
      litNetwork: this.litNetwork,
      alertWhenUnauthorized: false 
    });
    this.connected = false;
  }

  async initialize() {
    if (this.connected) return;
    await this.litClient.connect();
    this.connected = true;
    console.log("✅ LitNodeClient connected (network=%s)", this.litNetwork);
  }

  getClient() {
    return this.litClient;
  }

  // Encrypt an arbitrary string and store the symmetric key with Lit nodes
  async encryptString(plaintext, accessControlConditions, authSig, chain = "ethereum") {
    await this.initialize();

    const symKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const rawSym = await crypto.subtle.exportKey("raw", symKey);

    const encryptedSymmetricKey = await this.litClient.saveEncryptionKey({
      accessControlConditions,
      symmetricKey: Array.from(new Uint8Array(rawSym)),
      authSig,
      chain,
    });

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder().encode(plaintext);
    const cipherBuffer = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, symKey, enc);

    return {
      cipherHex: bufToHex(cipherBuffer),
      ivHex: bufToHex(iv),
      encryptedSymmetricKey,
    };
  }

  // Decrypt a string previously encrypted via encryptString
  async decryptString(cipherHex, ivHex, encryptedSymmetricKey, accessControlConditions, authSig, chain = "ethereum") {
    await this.initialize();

    const symmetricKeyRaw = await this.litClient.getEncryptionKey({
      accessControlConditions,
      toDecrypt: encryptedSymmetricKey,
      authSig,
      chain,
    });

    const symBuf = new Uint8Array(symmetricKeyRaw).buffer;
    const aesKey = await importAesKey(symBuf);

    const iv = hexToBuf(ivHex);
    const cipherBuf = hexToBuf(cipherHex);

    const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, cipherBuf);
    return new TextDecoder().decode(plainBuffer);
  }

  // Create an encrypted wallet object and return address + encrypted payload
  async createEncryptedWallet(accessControlConditions, authSig) {
    const wallet = ethers.Wallet.createRandom();
    const encrypted = await this.encryptString(wallet.privateKey, accessControlConditions, authSig, "ethereum");
    return {
      address: wallet.address,
      encryptedKey: encrypted,
      accessControlConditions,
    };
  }

  // Decrypt an encrypted wallet payload and return an ethers Wallet
  async decryptWallet(encryptedPayload, accessControlConditions, authSig) {
    const pk = await this.decryptString(
      encryptedPayload.cipherHex,
      encryptedPayload.ivHex,
      encryptedPayload.encryptedSymmetricKey,
      accessControlConditions,
      authSig,
      "ethereum"
    );
    return new ethers.Wallet(pk);
  }

  // Sign a transaction object (ethers v6) using the decrypted wallet
  async signTransaction(encryptedPayload, tx, accessControlConditions, authSig) {
    const wallet = await this.decryptWallet(encryptedPayload, accessControlConditions, authSig);
    return await wallet.signTransaction(tx);
  }

  async disconnect() {
    if (this.litClient) {
      try {
        await this.litClient.disconnect();
      } catch (e) {}
    }
    this.connected = false;
  }
}
