require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const {
  BASE_SEPOLIA_RPC_URL,
  SEPOLIA_RPC_URL,
  ALCHEMY_RPC_URL,
  PRIVATE_KEY,
  DEPLOYER_PRIVATE_KEY,
  BASESCAN_API_KEY,
  ETHERSCAN_API_KEY,
} = process.env;

const deployerKey = (DEPLOYER_PRIVATE_KEY || PRIVATE_KEY || "").trim();
const accounts = deployerKey ? [deployerKey] : [];

module.exports = {
  solidity: "0.8.19",
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: (SEPOLIA_RPC_URL || "").trim(),
      accounts,
    },
    baseSepolia: {
      url: (BASE_SEPOLIA_RPC_URL || ALCHEMY_RPC_URL || "").trim(),
      chainId: 84532,
      accounts,
    },
  },
  etherscan: {
    apiKey: {
      sepolia: (ETHERSCAN_API_KEY || "").trim(),
      baseSepolia: (BASESCAN_API_KEY || ETHERSCAN_API_KEY || "").trim(),
    },
  },
};
