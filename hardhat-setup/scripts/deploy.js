const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying BlockchainVoting contract...");
  
  // Get the contract factory
  const BlockchainVoting = await ethers.getContractFactory("BlockchainVoting");
  
  // Deploy the contract and wait for deployment
  const votingContract = await BlockchainVoting.deploy();
  await votingContract.waitForDeployment();
  
  const contractAddress = await votingContract.getAddress();
  console.log("✅ BlockchainVoting contract deployed to:", contractAddress);
  
  // Get the network information
  const network = await ethers.provider.getNetwork();
  console.log("📋 Network:", network.name, "(", network.chainId, ")");
  
  // Save deployment information to a file
  const fs = require("fs");
  const deploymentsDir = "./deployments";
  
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId,
    contract: "BlockchainVoting",
    address: contractAddress,
    deployer: (await ethers.getSigners())[0].address,
    timestamp: new Date().toISOString(),
    transactionHash: votingContract.deploymentTransaction().hash
  };
  
  const deploymentFile = `${deploymentsDir}/deployment-${network.chainId}.json`;
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("📄 Deployment info saved to:", deploymentFile);
  
  return votingContract.address;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});