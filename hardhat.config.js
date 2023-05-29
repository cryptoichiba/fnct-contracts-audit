require("@nomicfoundation/hardhat-toolbox");
require("hardhat-gas-reporter");
require("@nomiclabs/hardhat-web3");

// custom tasks
require("./tasks/add_validator");
require("./tasks/set_supply_pool");
require("./tasks/deploy");
require("./tasks/fnct_vesting_local");
require("./tasks/submit");

function getAccounts() {
  const accounts = []
  for (let i = 0; i < 20; i++) {
    if (process.env[`PRIVATE_KEY_${i}`] !== undefined) {
      accounts.push(process.env[`PRIVATE_KEY_${i}`])
    }
  }

  return accounts
}

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    mumbai: {
      url: process.env.MUMBAI_RPC_URL !== undefined ? process.env.MUMBAI_RPC_URL : "",
      accounts: getAccounts(),
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL !== undefined ? process.env.POLYGON_RPC_URL : "",
      accounts: getAccounts(),
    },
    hardhat: {
      accounts: {
        accountsBalance: '10000000000000000000000000000000000'
      },
    }
  },
  solidity: {
    compilers: [
    {
      version: "0.8.16",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    {
      version: "0.4.24",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }]
  },
  gasReporter: {
    enabled: (process.env.REPORT_GAS) ? true : false
  },
  mocha: {
    timeout: 1000000
  }
};
