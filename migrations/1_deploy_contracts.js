const TimeContract = artifacts.require("TimeContract");
const FNCToken = artifacts.require("FNCToken");
const ValidatorContract = artifacts.require("ValidatorContract");
const StakingContract = artifacts.require("StakingContract");
const RewardContract = artifacts.require("RewardContract");
const VaultContract = artifacts.require("VaultContract");
const RNG = artifacts.require("RandomNumberGenerator");


module.exports = async function(deployer) {
  await deployer.deploy(TimeContract, 3600); // For test purposes 1 day == 5 sec
  await deployer.deploy(FNCToken);
  await deployer.deploy(RNG, TimeContract.address);
  await deployer.deploy(ValidatorContract, TimeContract.address);
  await deployer.deploy(VaultContract, TimeContract.address, FNCToken.address);
  await deployer.deploy(StakingContract, TimeContract.address, FNCToken.address, VaultContract.address);
  await deployer.deploy(RewardContract, TimeContract.address, FNCToken.address, StakingContract.address, ValidatorContract.address, VaultContract.address, RNG.address);
};
