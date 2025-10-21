const hre = require("hardhat");

async function main() {
  console.log("🪙 Minting MockUSDC tokens...\n");

  // Get contract address from env or use default
  const usdcAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  if (!usdcAddress) {
    console.error("❌ USDC_CONTRACT_ADDRESS not set in .env");
    process.exit(1);
  }

  const [signer] = await hre.ethers.getSigners();
  console.log("📍 Using account:", signer.address);

  // Get MockUSDC contract
  const mockUSDC = await hre.ethers.getContractAt("MockUSDC", usdcAddress);

  // Mint amount (default 1000 USDC)
  const amount = process.env.MINT_AMOUNT || "1000";
  const mintAmount = hre.ethers.parseUnits(amount, 6); // 6 decimals for USDC

  // Recipient (default to signer)
  const recipient = process.env.MINT_TO || signer.address;

  console.log(`💰 Minting ${amount} USDC to ${recipient}...`);
  const tx = await mockUSDC.mint(recipient, mintAmount);
  await tx.wait();

  console.log("✅ Minted successfully!");
  console.log("📝 Transaction hash:", tx.hash);

  // Check balance
  const balance = await mockUSDC.balanceOf(recipient);
  console.log(`💵 New balance: ${hre.ethers.formatUnits(balance, 6)} USDC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
