const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying contracts to local Hardhat network...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deployer address:", deployer.address);
  console.log("💰 Deployer balance:", ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  // 1. Deploy MockUSDC
  console.log("🧪 Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy("Mock USDC", "USDC", 6);
  await mockUSDC.waitForDeployment();
  const usdcAddress = await mockUSDC.getAddress();
  console.log("✅ MockUSDC deployed to:", usdcAddress);

  // 2. Mint some USDC to deployer for testing
  console.log("🪙 Minting 10,000 USDC to deployer...");
  const mintAmount = ethers.parseUnits("10000", 6); // 10k USDC (6 decimals)
  await mockUSDC.mint(deployer.address, mintAmount);
  console.log("✅ Minted 10,000 USDC\n");

  // 3. Deploy CopyTradingVault
  console.log("🏦 Deploying CopyTradingVault...");
  const CopyTradingVault = await hre.ethers.getContractFactory("CopyTradingVault");
  const vault = await CopyTradingVault.deploy(usdcAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("✅ CopyTradingVault deployed to:", vaultAddress);

  // 4. Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("Network:", hre.network.name);
  console.log("Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);
  console.log("Deployer:", deployer.address);
  console.log("MockUSDC:", usdcAddress);
  console.log("CopyTradingVault:", vaultAddress);
  console.log("=".repeat(60));

  console.log("\n📝 Add these to your .env file:");
  console.log(`USDC_CONTRACT_ADDRESS=${usdcAddress}`);
  console.log(`VAULT_CONTRACT_ADDRESS=${vaultAddress}`);
  console.log(`PRIVATE_KEY=${deployer.privateKey}`);
  console.log(`EVM_RPC_URL=http://127.0.0.1:8545`);

  console.log("\n✨ Deployment complete! Run 'npm run contracts:start' to keep the node running.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
