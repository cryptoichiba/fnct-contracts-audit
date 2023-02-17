const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const {deployAll} = require('./support/deploy');

describe("Whole scenario with mock contract", function () {
    it("All", async function() {
        let [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, nobody] = await ethers.getSigners();
        let {
            TimeContract, FNCToken, ValidatorContract, VaultContract, StakingContract, RNG, LogFileHash, RewardContract
        } = await deployAll(false, owner);

        // Initialize validators
        await ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5);
        await ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5);
        await ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5);

        // Initialize pool
        const poolSize = 10000 * 10**18;
        FNCToken.connect(owner).approve(RewardContract.address, poolSize);
        RewardContract.connect(owner).supplyStakingPool(1, poolSize);
    });
});
