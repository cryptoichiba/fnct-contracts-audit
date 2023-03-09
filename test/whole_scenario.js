const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber } = ethers;
const { deployAll } = require("./support/deploy");
const {_logger} = require('truffle/build/553.bundled');

describe("Whole scenario with prod contract: Day0", function () {
    let _TimeContract, _FNCToken, _ValidatorContract, _VaultContract, _StakingContract, _LogFileHash, _RNG,
        _ChainlinkCoordinator, _ChainlinkWrapper, _RewardContract;
    let owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, delegator4, nobody, commissionReceiver;

    beforeEach(async function() {
        [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, delegator4, nobody, commissionReceiver] = await ethers.getSigners();
        const { TimeContract, FNCToken, ValidatorContract, VaultContract, StakingContract, LogFileHash, RNG,
            ChainlinkCoordinator, ChainlinkWrapper, RewardContract } = await deployAll(false, owner);
        await VaultContract.setupStakingRole(StakingContract.address);
        _TimeContract = TimeContract, _FNCToken = FNCToken, _ValidatorContract = ValidatorContract, _VaultContract = VaultContract,
            _StakingContract = StakingContract, _LogFileHash = LogFileHash, _RNG = RNG, _ChainlinkCoordinator = ChainlinkCoordinator,
            _ChainlinkWrapper = ChainlinkWrapper, _RewardContract = RewardContract;
    });

    it("Owner can manage validator list", async function () {
        await expect(
          _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5).then(tx => tx.wait())
        ).not.to.be.reverted;
    });

    it("Non-owner can't manage validator list", async function () {
        await expect(
          _ValidatorContract.connect(nobody).addValidator(validator1.address, '0x00', 10 ** 5).then(tx => tx.wait())
        ).to.be.revertedWith('Ownable: caller is not the owner');
    });

    describe("Step: After setup validators", function () {
        beforeEach(async function() {
            await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5).then(tx => tx.wait())
            await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5).then(tx => tx.wait())
            await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5).then(tx => tx.wait())
        });

        it("Transfer staking pool and check size", async function () {
            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000), "gwei"));
            const refillSize = String(web3.utils.toWei(web3.utils.toBN(2000), "gwei"));

            // Allocate initial rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            await expect(
                _RewardContract.connect(owner).supplyStakingPool(1, allocateSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            // Pool size for each days
            expect(await _RewardContract.getStakingPoolSize(0)).to.equal(0);
            expect(await _RewardContract.getStakingPoolSize(1)).to.equal(BigInt("10000000000000"));
            expect(await _RewardContract.getStakingPoolSize(2)).to.equal(BigInt("9982920000000"));
            expect(await _RewardContract.getStakingPoolSize(3)).to.equal(BigInt("9965869172640"));
            expect(await _RewardContract.getStakingPoolSize(4)).to.equal(BigInt("9948847468094"));
            expect(await _RewardContract.getStakingPoolSize(5)).to.equal(BigInt("9931854836619"));
            expect(await _RewardContract.getStakingPoolSize(6)).to.equal(BigInt("9914891228559"));
            // Approximately 5% for 30 days
            expect(await _RewardContract.getStakingPoolSize(31)).to.equal(BigInt("9500090113041"));

            // Allocated rewards size for each days
            expect(await _RewardContract.getDailyStakingRewardsAmount(0)).to.equal(0);
            expect(await _RewardContract.getDailyStakingRewardsAmount(1)).to.equal(BigInt("17080000000"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(2)).to.equal(BigInt("17050827360"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(3)).to.equal(BigInt("17021704546"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(4)).to.equal(BigInt("16992631475"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(5)).to.equal(BigInt("16963608060"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(6)).to.equal(BigInt("16934634218"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(31)).to.equal(BigInt("16226153913"));

            // Refill rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, refillSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            await expect(
                _RewardContract.connect(owner).supplyStakingPool(5, refillSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            // Pool size for each days
            expect(await _RewardContract.getStakingPoolSize(0)).to.equal(0);
            expect(await _RewardContract.getStakingPoolSize(1)).to.equal(BigInt("10000000000000"));
            expect(await _RewardContract.getStakingPoolSize(2)).to.equal(BigInt("9982920000000"));
            expect(await _RewardContract.getStakingPoolSize(3)).to.equal(BigInt("9965869172640"));
            expect(await _RewardContract.getStakingPoolSize(4)).to.equal(BigInt("9948847468094"));

            // base size + 2000
            expect(await _RewardContract.getStakingPoolSize(5)).to.equal(BigInt("11931854836619"));
            expect(await _RewardContract.getStakingPoolSize(6)).to.equal(BigInt("11911475228559"));

            // Allocated rewards size for each days
            expect(await _RewardContract.getDailyStakingRewardsAmount(0)).to.equal(0);
            expect(await _RewardContract.getDailyStakingRewardsAmount(1)).to.equal(BigInt("17080000000"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(2)).to.equal(BigInt("17050827360"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(3)).to.equal(BigInt("17021704546"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(4)).to.equal(BigInt("16992631475"));

            // base size  + 2000
            expect(await _RewardContract.getDailyStakingRewardsAmount(5)).to.equal(BigInt("20379608060"));
            expect(await _RewardContract.getDailyStakingRewardsAmount(6)).to.equal(BigInt("20344799690"));
        });

        it("Transfer pool fail(back date / initial)", async function () {
            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000), "gwei"))

            // Allocate initial rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            // back date
            await expect(
                _RewardContract.connect(owner).supplyStakingPool(0, allocateSize).then(tx => tx.wait())
            ).to.be.revertedWith('Reward: You can\'t specify day in the past');
        });

        it("Transfer pool fail(back date / day1)", async function () {
            await _TimeContract.setCurrentTimeIndex(1).then(tx => tx.wait());

            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000), "gwei"))

            // Allocate initial rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            // back date
            await expect(
                _RewardContract.connect(owner).supplyStakingPool(0, allocateSize).then(tx => tx.wait())
            ).to.be.revertedWith('Reward: You can\'t specify day in the past');
        });

        it("Transfer pool fail(back date / refill)", async function () {
            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000), "gwei"));
            const refillSize = String(web3.utils.toWei(web3.utils.toBN(2000), "gwei"));

            // Allocate initial rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            await expect(
                _RewardContract.connect(owner).supplyStakingPool(5, allocateSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            // Refill rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, refillSize).then(tx => tx.wait())
            ).not.to.be.reverted;

            // back date
            await expect(
                _RewardContract.connect(owner).supplyStakingPool(1, refillSize).then(tx => tx.wait())
            ).to.be.revertedWith('Reward: Already scheduled after specified day');
        });

        describe("Step: After setup rewards pool", function () {
            beforeEach(async function() {
                const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000000), "gwei"));
                await _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize).then(tx => tx.wait());
                await _RewardContract.connect(owner).supplyStakingPool(1, allocateSize);
            });

            it("Success: Delegate all tokens with a validator", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Success: Delegate all tokens without a validator", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, ethers.constants.AddressZero).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Success: Reset validator selection", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());
                await _TimeContract.connect(owner).setCurrentTimeIndex(1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate("0", ethers.constants.AddressZero).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Success: Select validator without lock", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _StakingContract.connect(delegator1).lockAndDelegate(vp1, ethers.constants.AddressZero).then(tx => tx.wait());
                await _TimeContract.connect(owner).setCurrentTimeIndex(1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate("0", validator1.address).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Success: Additional lock without changing the validator in a day", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());

                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Success: Change the validator twice without an additional lock", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());
                await _TimeContract.connect(owner).setCurrentTimeIndex(1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate("0", validator2.address).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Success: Change the validator twice in the other day with an additional lock", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());
                await _TimeContract.connect(owner).setCurrentTimeIndex(1).then(tx => tx.wait());

                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator2.address).then(tx => tx.wait())
                ).not.to.be.reverted;
            });

            it("Fail: Change the validator twice in a day", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate("0", validator2.address)
                ).to.be.revertedWith('Staking: You can\'t change a validator on the same day');

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator2.address).then(tx => tx.wait())
                ).to.be.revertedWith('Staking: You can\'t change a validator on the same day');
            });

            it("Fail: Delegate without approval", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait())
                ).to.be.revertedWith('ERC20: insufficient allowance');
            });

            it("Fail: Delegate with an invalid validator", async function () {
                // Validation power = FNCT tokens
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                await _TimeContract.connect(owner).setCurrentTimeIndex(1).then(tx => tx.wait());

                await expect(
                    _StakingContract.connect(delegator1).lockAndDelegate(vp1, nobody.address).then(tx => tx.wait())
                ).to.be.revertedWith('Staking: Validator is not in the whitelist');
            });

            describe("Step: Delegator lock tokens", function () {
                const file0 = web3.utils.hexToBytes("0xabcdabcd0");
                const file1 = web3.utils.hexToBytes("0xabcdabcd1");
                const file2 = web3.utils.hexToBytes("0xabcdabcd2");
                const file3 = web3.utils.hexToBytes("0xabcdabcd3");
                const vp0_5 = String(web3.utils.toWei(web3.utils.toBN(500), "gwei"));
                const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "gwei"));
                const vp2 = String(web3.utils.toWei(web3.utils.toBN(2000), "gwei"));
                const vp3 = String(web3.utils.toWei(web3.utils.toBN(3000), "gwei"));
                const vp4 = String(web3.utils.toWei(web3.utils.toBN(4000), "gwei"));

                beforeEach(async function() {
                    // Validation power=1000, 2000, 3000, 4000
                    await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                    await _FNCToken.connect(owner).transfer(delegator2.address, vp2).then(tx => tx.wait());
                    await _FNCToken.connect(owner).transfer(delegator3.address, vp3).then(tx => tx.wait());
                    await _FNCToken.connect(owner).transfer(delegator4.address, vp4).then(tx => tx.wait());
                    await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                    await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());
                    await _FNCToken.connect(delegator2).approve(_VaultContract.address, vp2).then(tx => tx.wait());
                    await _StakingContract.connect(delegator2).lockAndDelegate(vp2, validator1.address).then(tx => tx.wait());
                    await _FNCToken.connect(delegator3).approve(_VaultContract.address, vp3).then(tx => tx.wait());
                    await _StakingContract.connect(delegator3).lockAndDelegate(vp3, validator1.address).then(tx => tx.wait());
                    await _FNCToken.connect(delegator4).approve(_VaultContract.address, vp4).then(tx => tx.wait());
                    await _StakingContract.connect(delegator4).lockAndDelegate(vp4, validator2.address).then(tx => tx.wait());
                });

                it("Success: Submit", async function () {
                    await expect(
                        _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    await expect(
                        _LogFileHash.getLatestValidFile()
                    ).to.be.revertedWith('LogFileHash: No valid file yet');
                });

                it("Success: Submit after non-submission day / deleyed random number generation", async function () {
                    // Submit day:0
                    await expect(
                        _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    await expect(
                        _LogFileHash.connect(validator2).submit(validator2.address, 0, file0, file1).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    await expect(
                        _LogFileHash.getLatestValidFile()
                    ).to.be.revertedWith('LogFileHash: No valid file yet');

                    // Skip day:1
                    await _TimeContract.setCurrentTimeIndex(2).then(tx => tx.wait());

                    // Submit day:2
                    await expect(
                        _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    await expect(
                        _LogFileHash.connect(validator2).submit(validator2.address, 1, file1, file2).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    let result1 = await _LogFileHash.getLatestValidFile();
                    expect(result1[0]).to.equal(0);
                    expect(result1[1]).to.equal(web3.utils.bytesToHex(file0));

                    // Skip day:3
                    await _TimeContract.setCurrentTimeIndex(4).then(tx => tx.wait());

                    // Submit day:4
                    await expect(
                        _LogFileHash.connect(validator1).submit(validator1.address, 1, file1, file2).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    await expect(
                        _LogFileHash.connect(validator2).submit(validator2.address, 2, file2, file3).then(tx => tx.wait())
                    ).not.to.be.reverted;

                    let result2 = await _LogFileHash.getLatestValidFile();
                    expect(result2[0]).to.equal(1);
                    expect(result2[1]).to.equal(web3.utils.bytesToHex(file1));

                    await expect(
                        await _RewardContract.calcAvailableStakingRewardAmount(delegator1.address)
                    ).to.equal(0);

                    await expect(
                      _RewardContract.connect(delegator1).claimStakingReward()
                    ).to.emit(_RewardContract, "TransferredStakingReward").withArgs(delegator1.address, delegator1.address, 0, 0);

                    await expect(
                        _RewardContract.connect(validator1).claimStakingCommission(validator1.address)
                    ).to.emit(_RewardContract, "TransferredStakingCommission").withArgs(validator1.address, validator1.address, 0, 0);

                    // Random number generation deleyed (Request1 = Day 2, Request2 = Day 4)
                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                        BigNumber.from(1), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());
                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                        BigNumber.from(2), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                    // Delegator reward
                    let expectedReward = ethers.BigNumber.from("2557624104000");
                    await expect(
                        await _RewardContract.calcAvailableStakingRewardAmount(delegator1.address)
                    ).to.equal(expectedReward);

                    console.log(await _FNCToken.connect(owner).balanceOf(owner.address))
                    await expect(
                      _RewardContract.connect(delegator1).claimStakingReward({
                          gasLimit: 3_000_000,
                      })
                    ).to.emit(
                        _RewardContract, "TransferredStakingReward"
                    ).withArgs(
                        delegator1.address, delegator1.address, expectedReward, expectedReward
                    );

                    await expect(
                        _ValidatorContract.connect(nobody).setCommissionReceiver(commissionReceiver.address)
                    ).to.be.revertedWith("Validator: Caller is not validator or disabled");

                    await expect(
                        _ValidatorContract.connect(validator1).setCommissionReceiver(commissionReceiver.address)
                    ).not.to.be.reverted;

                    // no longer available as the receiver
                    await expect(
                        _RewardContract.connect(validator1).claimStakingCommission(validator1.address)
                    ).to.be.revertedWith("Reward: Sender is not allowed as a receiver");

                    // Validator comission
                    let expectedCommission = ethers.BigNumber.from("1705082736000");
                    await expect(
                        await _RewardContract.calcAvailableStakingCommissionAmount(validator1.address)
                    ).to.equal(expectedCommission);

                    // new receiver now available
                    await expect(
                        _RewardContract.connect(commissionReceiver).claimStakingCommission(validator1.address)
                    ).to.emit(
                        _RewardContract, "TransferredStakingCommission"
                    ).withArgs(
                        validator1.address, commissionReceiver.address, expectedCommission, expectedCommission
                    );
                });

                it("Fail: Submit future file index", async function () {
                    await expect(
                        _LogFileHash.connect(validator1).submit(validator1.address, 1, file0, file1)
                    ).to.be.revertedWith('LogFileHash: Index is invalid');
                });

                it("Fail: Non-validator submit", async function () {
                    await expect(
                        _LogFileHash.connect(nobody).submit(nobody.address, 0, file0, file1)
                    ).to.be.revertedWith('LogFileHash: Validator is not in the whitelist');
                });

                describe("Submit(day0)", function () {
                    let WinnerStatus = {
                        Decided: 0,
                        NoWinnerForFutureDate: 1,
                        NoMajority: 2,
                        NoSubmissionToday: 3,
                        Pending: 4,
                        Abandoned: 5
                    };

                    beforeEach(async function() {
                        await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1).then(tx => tx.wait())
                        await _LogFileHash.connect(validator2).submit(validator2.address, 0, file0, file1).then(tx => tx.wait())
                    });

                    it("Fail: getWinner(day0)", async function () {
                        let result = await _LogFileHash.getWinner(0);
                        expect(result[1]).to.equal(WinnerStatus.NoWinnerForFutureDate);
                        expect(result[0]).to.equal(ethers.constants.AddressZero);
                    });

                    it("Fail: No rewards yet", async function () {
                        await expect(
                            await _RewardContract.calcAvailableStakingRewardAmount(delegator1.address)
                        ).to.equal(0);
                    });

                    describe("Day1", function () {
                        beforeEach(async function() {
                            await _TimeContract.setCurrentTimeIndex(1).then(tx => tx.wait());

                            // Additional lock
                            await _FNCToken.connect(owner).transfer(delegator1.address, vp1).then(tx => tx.wait());
                            await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1).then(tx => tx.wait());
                            await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address).then(tx => tx.wait());
                        });

                        it("Fail: getWinner(day0) before submission", async function () {
                            let result = await _LogFileHash.getWinner(0);
                            expect(result[1]).to.equal(WinnerStatus.NoSubmissionToday);
                            expect(result[0]).to.equal(ethers.constants.AddressZero);
                        });

                        it("Success: submit(day1)", async function () {
                            await expect (
                                _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1).then(tx => tx.wait())
                            ).not.to.be.reverted;
                        });

                        describe("Submit(day1)", function () {
                            beforeEach(async function() {
                                await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1).then(tx => tx.wait())
                                await _LogFileHash.connect(validator2).submit(validator2.address, 1, file1, file2).then(tx => tx.wait())
                            });

                            it("Fail: getWinner(day0) while RNG processing", async function () {
                                let result = await _LogFileHash.getWinner(0);
                                expect(result[1]).to.equal(WinnerStatus.Pending);
                                expect(result[0]).to.equal(ethers.constants.AddressZero);
                            });

                            it("Success: getWinner(day0) after RNG processing(Random=500)", async function () {
                                // 1000, 2000, 3000 -> 0 <= [500] < 1000
                                await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                    BigNumber.from(1), _ChainlinkWrapper.address, [web3.utils.toWei("500", "gwei")]).then(tx => tx.wait());
                                let result = await _LogFileHash.getWinner(0);
                                expect(result[1]).to.equal(WinnerStatus.Decided);
                                expect(result[0]).to.equal(validator1.address);
                            });

                            it("Success: getWinner(day0) after RNG processing(Random=5999)", async function () {
                                // 1000, 2000, 3000 -> 0 <= [5999] < 1000
                                await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                    BigNumber.from(1), _ChainlinkWrapper.address, [web3.utils.toWei("5999", "gwei")]).then(tx => tx.wait());
                                let result = await _LogFileHash.getWinner(0);
                                expect(result[1]).to.equal(WinnerStatus.Decided);
                                expect(result[0]).to.equal(validator1.address);
                            });

                            it("Success: getWinner(day0) after RNG processing(Random=6000)", async function () {
                                // 1000, 2000, 3000 -> 1000 <= [6000] < 3000
                                await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                    BigNumber.from(1), _ChainlinkWrapper.address, [web3.utils.toWei("6000", "gwei")]).then(tx => tx.wait());
                                let result = await _LogFileHash.getWinner(0);
                                expect(result[1]).to.equal(WinnerStatus.Decided);
                                expect(result[0]).to.equal(validator2.address);
                            });

                            it("Success: getWinner(day0) after RNG processing(Random=6500)", async function () {
                                // 1000, 2000, 3000 -> 1000 <= [6500] < 3000
                                await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                    BigNumber.from(1), _ChainlinkWrapper.address, [web3.utils.toWei("6500", "gwei")]).then(tx => tx.wait());
                                let result = await _LogFileHash.getWinner(0);
                                expect(result[1]).to.equal(WinnerStatus.Decided);
                                expect(result[0]).to.equal(validator2.address);
                            });

                            it("Fail: getWinner(day1)", async function () {
                                let result = await _LogFileHash.getWinner(1);
                                expect(result[1]).to.equal(WinnerStatus.NoWinnerForFutureDate);
                                expect(result[0]).to.equal(ethers.constants.AddressZero);
                            });

                            it("Fail: Didn't supply reward at Day0", async function () {
                                await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                    BigNumber.from(1), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());
                                await expect(
                                    await _RewardContract.calcAvailableStakingRewardAmount(delegator1.address)
                                ).to.equal(0);
                            });

                            it("Fail: Unlock tokens yet", async function () {
                                await expect (
                                    _StakingContract.connect(delegator1).unlock(vp1).then(tx => tx.wait())
                                ).to.be.revertedWith('Vault: Requested amount exceeds unlockable');
                            });

                            describe("Day2", function () {
                                beforeEach(async function() {
                                    await _TimeContract.setCurrentTimeIndex(2).then(tx => tx.wait());
                                });

                                describe("Submit(day2)", function () {
                                    beforeEach(async function() {
                                        await _LogFileHash.connect(validator1).submit(validator1.address, 1, file1, file2).then(tx => tx.wait())
                                        await _LogFileHash.connect(validator2).submit(validator2.address, 2, file2, file3).then(tx => tx.wait())
                                    });

                                    it("Success: Get Reward", async function () {
                                        // dailyReward * (myLock / totalLock) * (100% - commissionRate);
                                        const expected = 4392;              // 17080 * 2000 / 7000 * 90% = 4392 tokens
                                        const expectedCommission = 1708;    // 17080 * 10%
                                        await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                            BigNumber.from(2), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                        // Pre token balance
                                        await expect(
                                            await _FNCToken.balanceOf(delegator1.address)
                                        ).to.equal(0);

                                        // Calc
                                        await expect(
                                            await _RewardContract.calcAvailableStakingRewardAmount(delegator1.address)
                                        ).to.equal(web3.utils.toWei(expected.toString(), "gwei"));

                                        // Receive
                                        await expect(
                                            _RewardContract.connect(delegator1).claimStakingReward().then(tx => tx.wait())
                                        ).not.to.be.reverted

                                        // Receive commission
                                        await expect(
                                            _RewardContract.connect(validator1).claimStakingCommission(validator1.address).then(tx => tx.wait())
                                        ).not.to.be.reverted

                                        // After token balance
                                        await expect(
                                            await _FNCToken.balanceOf(delegator1.address)
                                        ).to.equal(web3.utils.toWei(expected.toString(), "gwei"));

                                        // Already received: Calc
                                        await expect(
                                            await _RewardContract.calcAvailableStakingRewardAmount(delegator1.address)
                                        ).to.equal(0);

                                        // Already received, but no error: claim
                                        await expect(
                                            _RewardContract.connect(delegator1).claimStakingReward().then(tx => tx.wait())
                                        ).not.to.be.reverted

                                        // Already received, but no error: claim commission
                                        await expect(
                                            _RewardContract.connect(validator1).claimStakingCommission(validator1.address).then(tx => tx.wait())
                                        ).not.to.be.reverted

                                        // After token balance
                                        await expect(
                                            await _FNCToken.balanceOf(delegator1.address)
                                        ).to.equal(web3.utils.toWei(expected.toString(), "gwei"));
                                        
                                        // After token balance
                                        await expect(
                                            await _FNCToken.balanceOf(validator1.address)
                                        ).to.equal(web3.utils.toWei(expectedCommission.toString(), "gwei"));
                                    });
                                });
                            });

                            describe("Day3", function () {
                                beforeEach(async function() {
                                    await _TimeContract.setCurrentTimeIndex(2).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 1, file1, file2).then(tx => tx.wait())
                                    await _LogFileHash.connect(validator2).submit(validator2.address, 2, file2, file3).then(tx => tx.wait())
                                });

                                it("Success: Get Reward(day2 / day3)", async function () {
                                    // dailyReward * (myLock / totalLock) * (100% - commissionRate);
                                    // 17080 * 2000 / 7000 * 90% = 4392 tokens
                                    const expectedDay1 = 4392;
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(2), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    // Receive on day2
                                    expectedReward = ethers.BigNumber.from("4392000000000");
                                    accumulatedReward = ethers.BigNumber.from("4392000000000");
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward()
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, expectedReward, accumulatedReward
                                    );

                                    await _TimeContract.setCurrentTimeIndex(3).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 2, file1, file2).then(tx => tx.wait())
                                    await _LogFileHash.connect(validator2).submit(validator2.address, 3, file2, file3).then(tx => tx.wait())

                                    // dailyReward * (myLock / totalLock) * (100% - commissionRate);
                                    // 17050.82736 * 2000 / 7000 * 90% = 4384.498464 tokens
                                    const expectedDay2 = 4384.498464;
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(3), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    // Receive on day3
                                    expectedReward = ethers.BigNumber.from("4384498464000");
                                    accumulatedReward = ethers.BigNumber.from("8776498464000");
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward()
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, expectedReward, accumulatedReward
                                    );

                                    // After token balance
                                    await expect(
                                        await _FNCToken.balanceOf(delegator1.address)
                                    ).to.equal(web3.utils.toWei((expectedDay1 + expectedDay2).toString(), "gwei"));
                                });

                                it("Success: Get Reward(day3)", async function () {
                                    // dailyReward * (myLock / totalLock) * (100% - commissionRate);
                                    // 17080 * 2000 / 7000 * 90% = 4392 tokens
                                    const expectedDay1 = 4392;
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(2), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    await _TimeContract.setCurrentTimeIndex(3).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 2, file1, file2).then(tx => tx.wait())
                                    await _LogFileHash.connect(validator2).submit(validator2.address, 3, file2, file3).then(tx => tx.wait())

                                    // dailyReward * (myLock / totalLock) * (100% - commissionRate);
                                    // 17050.82736 * 2000 / 7000 * 90% = 4384.498464 tokens
                                    const expectedDay2 = 4384.498464;
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(3), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    // Receive at once
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward().then(tx => tx.wait())
                                    ).not.to.be.reverted

                                    // Receive at once
                                    await expect(
                                        _RewardContract.connect(validator1).claimStakingCommission(validator1.address).then(tx => tx.wait())
                                    ).not.to.be.reverted

                                    // After token balance
                                    await expect(
                                        await _FNCToken.balanceOf(delegator1.address)
                                    ).to.equal(web3.utils.toWei((expectedDay1 + expectedDay2).toString(), "gwei"));
                                });
                            });

                            describe("Day180", function () {
                                beforeEach(async function() {
                                    await _TimeContract.setCurrentTimeIndex(180).then(tx => tx.wait());
                                });

                                it("Fail: Unlock tokens yet", async function () {
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp1).then(tx => tx.wait())
                                    ).to.be.revertedWith('Vault: Requested amount exceeds unlockable');
                                });
                            });

                            describe("Day181", function () {
                                beforeEach(async function() {
                                    await _TimeContract.setCurrentTimeIndex(181).then(tx => tx.wait());
                                });

                                it("Success: Unlock tokens at once", async function () {
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp1).then(tx => tx.wait())
                                    ).not.to.be.reverted;
                                });

                                it("Success: Unlock tokens separetelly", async function () {
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp0_5).then(tx => tx.wait())
                                    ).not.to.be.reverted;
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp0_5).then(tx => tx.wait())
                                    ).not.to.be.reverted;
                                });

                                it("Fail: Unlock tokens that locked at day1", async function () {
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp2).then(tx => tx.wait())
                                    ).to.be.revertedWith('Vault: Requested amount exceeds unlockable');
                                });
                            });

                            describe("Day182", function () {
                                beforeEach(async function() {
                                    await _TimeContract.setCurrentTimeIndex(182).then(tx => tx.wait());
                                });

                                it("Success: Unlock tokens that locked at day1", async function () {
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp2).then(tx => tx.wait())
                                    ).not.to.be.reverted;
                                });

                                it("Fail: Unlock tokens more than they locked", async function () {
                                    await expect (
                                        _StakingContract.connect(delegator1).unlock(vp3).then(tx => tx.wait())
                                    ).to.be.revertedWith('Staking: Requested amount exceeds unlockable');
                                });
                            });

                            describe("Day182: reward amount related to unlock", function () {
                                it("Reward without unlock at day 181", async function () {
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(1), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(2), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    await expect(
                                        await _StakingContract.getTotalDelegatedTo(181, validator1.address)
                                    ).to.equal(ethers.BigNumber.from("7000000000000"));

                                    await _TimeContract.setCurrentTimeIndex(181).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 1, file1, file2).then(tx => tx.wait())

                                    let beforeLock = ethers.BigNumber.from("4392000000000");

                                    // Receive 45 days
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward()
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, beforeLock, beforeLock
                                    )

                                    await _TimeContract.setCurrentTimeIndex(182).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 2, file2, file3).then(tx => tx.wait())
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(3), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    await expect(
                                        await _VaultContract.calcLockOfDay(181, delegator1.address)
                                    ).to.equal(ethers.BigNumber.from("2000000000000"));

                                    allocated = await _RewardContract.getDailyStakingRewardsAmount(181);
                                    expected = allocated.mul(2).mul(90).div(7).div(100) // 2/7 vp - 10% commission
                                    accumulated = expected.add(beforeLock)

                                    // Receive 45 days (total 90 days)
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward(claimOption)
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, 0, beforeLock
                                    )

                                    // Receive 45 days (total 135 days)
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward(claimOption)
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, 0, beforeLock
                                    )

                                    // Receive 45 days (total 180 days)
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward()
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, expected, accumulated
                                    )
                                });

                                it("Reward after unlock at day 181", async function () {
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(1), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(2), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    await expect(
                                        await _StakingContract.getTotalDelegatedTo(181, validator1.address)
                                    ).to.equal(ethers.BigNumber.from("7000000000000"));

                                    await _TimeContract.setCurrentTimeIndex(181).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 1, file1, file2).then(tx => tx.wait())

                                    let beforeLock = ethers.BigNumber.from("4392000000000");

                                    // Receive 45 days
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward()
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, beforeLock, beforeLock
                                    );

                                    await _StakingContract.connect(delegator1).unlock(ethers.BigNumber.from("1000000000000")).then(tx => tx.wait());

                                    await expect(
                                        await _StakingContract.getTotalDelegatedTo(181, validator1.address)
                                    ).to.equal(ethers.BigNumber.from("6000000000000"));

                                    await _TimeContract.setCurrentTimeIndex(182).then(tx => tx.wait());
                                    await _LogFileHash.connect(validator1).submit(validator1.address, 2, file2, file3).then(tx => tx.wait())
                                    await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                                        BigNumber.from(3), _ChainlinkWrapper.address, [0]).then(tx => tx.wait());

                                    await expect(
                                        await _VaultContract.calcLockOfDay(181, delegator1.address)
                                    ).to.equal(ethers.BigNumber.from("1000000000000"));

                                    allocated = await _RewardContract.getDailyStakingRewardsAmount(181);
                                    expected = allocated.mul(1).mul(90).div(6).div(100) // 1/6 vp - 10% commission
                                    accumulated = expected.add(beforeLock)

                                    // Receive 45 days (total 90 days)
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward(claimOption)
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, 0, beforeLock
                                    )

                                    // Receive 45 days (total 135 days)
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward(claimOption)
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, 0, beforeLock
                                    )

                                    // Receive 45 days (total 180 days)
                                    await expect(
                                        _RewardContract.connect(delegator1).claimStakingReward()
                                    ).to.emit(
                                        _RewardContract, "TransferredStakingReward"
                                    ).withArgs(
                                        delegator1.address, delegator1.address, expected, accumulated
                                    )
                                });
                            });
                        });
                    });
                });
            });
        });
    });
});
