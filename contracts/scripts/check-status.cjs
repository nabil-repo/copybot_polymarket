const hre = require("hardhat");

async function main() {
  console.log("📊 Checking contract balances and info...\n");

  const [signer] = await hre.ethers.getSigners();
  console.log("📍 Signer address:", signer.address);
  console.log("💰 ETH balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(signer.address)), "ETH\n");

  // Check USDC
  const usdcAddress = process.env.USDC_CONTRACT_ADDRESS||'0x5FbDB2315678afecb367f032d93F642f64180aa3';
  console.log("🔍 Checking USDC contract...",usdcAddress);
  if (usdcAddress) {
    console.log("🪙 MockUSDC Contract:", usdcAddress);
    try {
      const usdc = await hre.ethers.getContractAt("MockUSDC", usdcAddress);
      const balance = await usdc.balanceOf(signer.address);
      const decimals = await usdc.decimals();
      const name = await usdc.name();
      const symbol = await usdc.symbol();
      
      console.log("  Name:", name);
      console.log("  Symbol:", symbol);
      console.log("  Decimals:", decimals);
      console.log("  Your balance:", hre.ethers.formatUnits(balance, decimals), symbol);
    } catch (error) {
      console.log("  ❌ Error:", error.message);
    }
  }

  // Check Vault
  const vaultAddress = process.env.VAULT_CONTRACT_ADDRESS || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0';
  if (vaultAddress) {
    console.log("\n🏦 CopyTradingVault Contract:", vaultAddress);
    try {
      const vault = await hre.ethers.getContractAt("CopyTradingVault", vaultAddress);
      const usdcToken = await vault.usdcToken();
      const totalShares = await vault.totalShares();
      const totalDeposits = await vault.totalDeposits();
      const totalWithdrawals = await vault.totalWithdrawals();
      const userShares = await vault.shares(signer.address);
      
      console.log("  USDC Token:", usdcToken);
      console.log("  Total Shares:", totalShares.toString());
      console.log("  Total Deposits:", hre.ethers.formatUnits(totalDeposits, 6), "USDC");
      console.log("  Total Withdrawals:", hre.ethers.formatUnits(totalWithdrawals, 6), "USDC");
      console.log("  Your Shares:", userShares.toString());
    } catch (error) {
      console.log("  ❌ Error:", error.message);
    }
  }

  console.log("\n✅ Status check complete");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
