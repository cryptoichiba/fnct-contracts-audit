const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const {deployAll} = require('./support/deploy');

describe("Performance", function () {
    let _TimeContract, _FNCToken, _ValidatorContract, _VaultContract, _StakingContract, _LogFileHash, _RNG, _RewardContract;
    let owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, nobody;

    beforeEach(async function() {
        [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, nobody] = await ethers.getSigners();
        const { TimeContract, FNCToken, ValidatorContract, VaultContract, StakingContract, LogFileHash, RNG, RewardContract } = await deployAll(false, owner);
        await VaultContract.setupStakingRole(StakingContract.address);
        _TimeContract = TimeContract, _FNCToken = FNCToken, _ValidatorContract = ValidatorContract, _VaultContract = VaultContract,
            _StakingContract = StakingContract, _LogFileHash = LogFileHash, _RNG = RNG, _RewardContract = RewardContract;
    });

    describe("Whole senario", function () {
        describe("Step: After setup validators", function () {
            beforeEach(async function() {
                await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5)
                await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5)
                await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5)
            });

            it.skip("Performance requirement: Should not reach to the gasLimit for 1K times pool management", async function () {
                const allocateSize = String("1");
                const current = Number(await _TimeContract.getCurrentTimeIndex());

                for ( let i = 1; i <= 1000; i++ ) {
                    // Allocate rewards
                    _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize);
                    _RewardContract.connect(owner).supplyStakingPool(current + i, allocateSize);
                }

                expect(
                    await _RewardContract.getDailyRewardsAmount(current + 30000)
                ).not.to.be.reverted;
            });

            describe("Step: After setup rewards pool", function () {
                beforeEach(async function() {
                    const allocateSize = web3.utils.toWei(web3.utils.toBN(10000), "ether");
                    const current = await _TimeContract.getCurrentTimeIndex();
                    _FNCToken.connect(owner).approve(_StakingContract.address, allocateSize);
                    _RewardContract.connect(owner).supplyStakingPool(current+1, allocateSize);
                });

                it.skip("Performance requirement: Should not reach to the gasLimit for 100K users / 10 Years staking", async function () {
                    for ( let i = 1; i <= 100000; i++ ) {
                        _TimeContract.setCurrentTimeIndex(Number(i));
                    }
                });
            });
        });
    });
});
