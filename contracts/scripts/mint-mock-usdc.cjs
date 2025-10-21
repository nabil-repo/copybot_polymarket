const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const to = process.env.MINT_TO_ADDRESS || (await deployer.getAddress());
  const amount = process.env.MINT_AMOUNT || "100000000"; // 100 USDC with 6 decimals

  const mockAddress = process.env.USDC_CONTRACT_ADDRESS;
  if (!mockAddress) {
    throw new Error("USDC_CONTRACT_ADDRESS must be set to the deployed MockUSDC address");
  }

  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mock = MockUSDC.attach(mockAddress);

  console.log(`🪙 Minting ${amount} (units) USDC to ${to} on ${hre.network.name} ...`);
  const tx = await mock.mint(to, amount);
  await tx.wait();
  console.log("✅ Minted USDC to:", to);
}

main().catch((e) => { console.error(e); process.exit(1); });
