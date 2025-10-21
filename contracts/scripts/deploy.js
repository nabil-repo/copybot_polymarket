const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying CopyTradingVault...");

  // Resolve USDC address from env or deploy MockUSDC for non-ETH networks
  const network = hre.network.name;
  let usdcAddress = process.env.USDC_CONTRACT_ADDRESS;

  if (!usdcAddress) {
    if (network === 'ETH' || network === 'matic') {
      usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    } else {
      console.log("🧪 No USDC address provided, deploying MockUSDC for network:", network);
      const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
      const mock = await MockUSDC.deploy("Mock USDC", "USDC", 6);
      await mock.waitForDeployment();
      usdcAddress = await mock.getAddress();
      console.log("✅ MockUSDC deployed:", usdcAddress);
    }
  }

  const CopyTradingVault = await hre.ethers.getContractFactory("CopyTradingVault");
  const vault = await CopyTradingVault.deploy(usdcAddress);

  await vault.waitForDeployment();

  const address = await vault.getAddress();
  console.log("✅ CopyTradingVault deployed to:", address);

  // Wait for block confirmations
  console.log("⏳ Waiting for block confirmations...");
  await vault.deploymentTransaction().wait(5);

  // Verify on ETHscan
  if (process.env.ETHSCAN_API_KEY) {
    console.log("🔍 Verifying contract on ETHscan...");
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: [USDC_ADDRESS],
      });
      console.log("✅ Contract verified");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }

  console.log("\n📋 Contract Details:");
  console.log("Address:", address);
  console.log("USDC Token:", usdcAddress);
  console.log("\n🔗 View on Blockscout:", `https://ETH.blockscout.com/address/${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
