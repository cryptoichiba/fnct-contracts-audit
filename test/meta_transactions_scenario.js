const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { genInstantSigner } = require("./support/utils");
const {
  createStakingRewardTransferTicket,
  createCTHRewardTransferTicket,
  ZeroCTHRewardTransferTicket,
  ZeroStakingRewardTransferTicket,
} = require("./support/ticket");
const {deployAll} = require('./support/deploy');
const {constants} = require("@openzeppelin/test-helpers");

describe("Meta Transaction: Day0", function () {
    let _TimeContract, _FNCToken, _ValidatorContract, _VaultContract, _StakingContract, _LogFileHash, _RNG, _RewardContract;
    let owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, delegator4, nobody, worker;

    beforeEach(async function() {
        [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, delegator4, nobody, worker, signer] = await ethers.getSigners();
        const { TimeContract, FNCToken, ValidatorContract, VaultContract, StakingContract, LogFileHash, RNG, RewardContract } = await deployAll(false, owner);
        await VaultContract.setupStakingRole(StakingContract.address);
        _TimeContract = TimeContract, _FNCToken = FNCToken, _ValidatorContract = ValidatorContract, _VaultContract = VaultContract,
            _StakingContract = StakingContract, _LogFileHash = LogFileHash, _RNG = RNG, _RewardContract = RewardContract;
    });

    describe("Step: After setup", function () {
        const file0 = web3.utils.hexToBytes("0xabcdabcda0");
        const file1 = web3.utils.hexToBytes("0xabcdabcda1");
        const file2 = web3.utils.hexToBytes("0xabcdabcda2");
        const file3 = web3.utils.hexToBytes("0xabcdabcda3");
        const vp1 = String(web3.utils.toWei(web3.utils.toBN(1000), "ether"));
        const vp2 = String(web3.utils.toWei(web3.utils.toBN(2000), "ether"));
        const vp3 = String(web3.utils.toWei(web3.utils.toBN(3000), "ether"));
        const vp4 = String(web3.utils.toWei(web3.utils.toBN(4000), "ether"));
        let WinnerStatus = {
            Decided: 0,
            NoWinnerForFutureDate: 1,
            NoMajority: 2,
            NoSubmissionToday: 3,
            Pending: 4
        };

        beforeEach(async function() {
            await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5);
            await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5);
            await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5);

            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000000), "ether"));
            const allocateSizeForCTH = String(web3.utils.toWei(web3.utils.toBN(10000000), "ether"));
            _FNCToken.connect(owner).mint(owner.address, allocateSize + allocateSizeForCTH);
            _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize + allocateSizeForCTH);
            await _RewardContract.connect(owner).supplyStakingPool(1, allocateSize);
            await _RewardContract.connect(owner).supplyCTHPool(allocateSizeForCTH);

            // Validation power=1000, 2000, 3000, 4000
            _FNCToken.connect(owner).mint(delegator1.address, vp1);
            _FNCToken.connect(owner).mint(delegator2.address, vp2);
            _FNCToken.connect(owner).mint(delegator3.address, vp3);
            _FNCToken.connect(owner).mint(delegator4.address, vp4);
            _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1);
            _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address);
            _FNCToken.connect(delegator2).approve(_VaultContract.address, vp2);
            _StakingContract.connect(delegator2).lockAndDelegate(vp2, validator1.address);
            _FNCToken.connect(delegator3).approve(_VaultContract.address, vp3);
            _StakingContract.connect(delegator3).lockAndDelegate(vp3, validator1.address);
            _FNCToken.connect(delegator4).approve(_VaultContract.address, vp4);
            _StakingContract.connect(delegator4).lockAndDelegate(vp4, validator2.address);

            await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1);
            await _LogFileHash.connect(validator2).submit(validator2.address, 0, file0, file1);

            await _TimeContract.setCurrentTimeIndex(1);

            // Additional lock
            _FNCToken.connect(owner).mint(delegator1.address, vp1);
            _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1);
            _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address);

            await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1);
            await _LogFileHash.connect(validator2).submit(validator2.address, 1, file1, file2);

            await _TimeContract.setCurrentTimeIndex(2);

            await _LogFileHash.connect(validator1).submit(validator1.address, 1, file1, file2);
            await _LogFileHash.connect(validator2).submit(validator2.address, 2, file2, file3);

            await _RNG.setRandomNumber(1, 0);
        });

        it("Success: Get Reward(Meta tx / valid ticket)", async function () {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expected = ethers.utils.parseUnits("4392");
            const valid_ticket = await createStakingRewardTransferTicket(delegator1, 0);

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(valid_ticket)
            ).not.to.be.reverted

            // After token balance
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expected);
        });

        it("Success: Get Reward with CTH Reward(Self tx / valid ticket)", async function () {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expectedStaking = ethers.utils.parseUnits("4392");
            const expectedCTH = ethers.utils.parseUnits("500");
            const valid_ticket = await createCTHRewardTransferTicket(delegator1, expectedCTH);

            await expect(
                _RewardContract.connect(delegator1).claimRewards(valid_ticket)
            ).to.be.emit(_RewardContract, "TransferredStakingReward");

            // After token balance
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expectedStaking.add(expectedCTH));
        });

        it("Success: Change signer", async function () {
            const expectedCTH = ethers.utils.parseUnits("500");

            // before change / old signer => success
            const valid_ticket = await createCTHRewardTransferTicket(delegator1, expectedCTH, owner);
            await expect(
                _RewardContract.connect(delegator1).claimRewards(valid_ticket)
            ).to.be.emit(_RewardContract, "TransferredStakingReward");

            await expect(
                _RewardContract.connect(owner).setTicketSigner(signer.address)
            ).not.to.be.reverted;

            // after changed / old signer => fail
            const invalid_ticket = await createCTHRewardTransferTicket(delegator1, expectedCTH, owner);
            await expect(
                _RewardContract.connect(delegator1).claimRewards(invalid_ticket)
            ).to.be.revertedWith("Reward: Invalid head signer");

            // after changed / new signer => success
            const valid_new_ticket = await createCTHRewardTransferTicket(delegator1, expectedCTH, signer);
            await expect(
                _RewardContract.connect(delegator1).claimRewards(valid_new_ticket)
            ).to.be.emit(_RewardContract, "TransferredStakingReward");
        });

        it("Fail: Change signer(Non-owner)", async function () {
            await expect(
                _RewardContract.connect(nobody).setTicketSigner(signer.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Fail: Get Reward(Meta tx / invalid ticket: set wrong amount)", async function () {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expected = ethers.utils.parseUnits("4392");
            const wrongAmount = ethers.utils.parseUnits("4393");
            const invalid_ticket = await createStakingRewardTransferTicket(delegator1, wrongAmount);

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(invalid_ticket)
            ).not.to.be.reverted
            expect(await _FNCToken.balanceOf(delegator1.address)).not.to.equal(wrongAmount);
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expected);
        });

        it("Fail: Get Reward(Meta tx / invalid ticket: receiver is not delegator)", async function () {
            const expected = ethers.utils.parseUnits("4392");
            const invalid_ticket = await createStakingRewardTransferTicket(nobody, 0);

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(invalid_ticket)
            ).not.to.be.reverted
            expect(await _FNCToken.balanceOf(nobody.address)).to.equal(0);
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(0);
        });

        it("Fail: Get Reward(Meta tx / invalid ticket: signed by not owner)", async function () {
            const expected = ethers.utils.parseUnits("4392");
            const invalid_ticket = await createStakingRewardTransferTicket(delegator1, 0, nobody);

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(invalid_ticket)
            ).to.be.revertedWith('Reward: Invalid head signer');
        });

        it("Fail: Get Reward(Meta tx / invalid ticket: falsified ticketSigner)", async function () {
            const expected = ethers.utils.parseUnits("4392");
            const invalid_ticket = await createStakingRewardTransferTicket(delegator1, 0);

            const { instantSigner: otherInstantSigner } = genInstantSigner();

            invalid_ticket.ticketSigner = otherInstantSigner.address;

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(invalid_ticket)
            ).to.be.revertedWith('Reward: Invalid body signer');
        });

        it("Fail: Get Reward(Meta tx / invalid ticket: falsified metaSignature)", async function () {
            const expected = ethers.utils.parseUnits("4392");
            const invalid_ticket = await createStakingRewardTransferTicket(delegator1, 0);

            const { instantSigner: otherInstantSigner } = genInstantSigner();
            const falsifiedMetaDataHash = ethers.utils.solidityKeccak256(["bytes"], [otherInstantSigner.address]);
            const falsifiedMetaSignature = await owner.signMessage(ethers.utils.arrayify(falsifiedMetaDataHash));

            invalid_ticket.metaSignature = falsifiedMetaSignature;

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(invalid_ticket)
            ).to.be.revertedWith('Reward: Invalid head signer');
        });

        it("Fail: Get Reward(Meta tx / invalid ticket: falsified bodySignature)", async function () {
            const expected = ethers.utils.parseUnits("4392");
            const invalid_ticket = await createStakingRewardTransferTicket(delegator1, 0);

            const { instantSigner: otherInstantSigner } = genInstantSigner();
            const falsifiedBodyHash = ethers.utils.solidityKeccak256(["bytes", "uint"], [delegator1.address, ethers.utils.parseUnits("9999")]);
            const falsifiedBodySignature = await otherInstantSigner.signMessage(ethers.utils.arrayify(falsifiedBodyHash));

            invalid_ticket.bodySignature = falsifiedBodySignature;

            await expect(
                _RewardContract.connect(worker).metaClaimStakingReward(invalid_ticket)
            ).to.be.revertedWith('Reward: Invalid body signer');
        });

        it("Success: Get Staking Reward with CTH Reward(Meta tx / valid ticket)", async function () {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expectedStaking = ethers.utils.parseUnits("4392");
            const expectedCTH = ethers.utils.parseUnits("500");

            const ticketForStaking = await createStakingRewardTransferTicket(delegator1, 0);
            const ticketForCTH = await createCTHRewardTransferTicket(delegator1, expectedCTH);

            await expect(
                _RewardContract.connect(worker).metaClaimRewards({
                  ticketForStaking,
                  ticketForCTH
                })
            ).not.to.be.reverted

            // After token balance
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expectedStaking.add(expectedCTH));
        });

        it("Fail: Get Staking Reward with CTH Reward(Meta tx / invalid ticket: receivers are not same)", async function () {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expectedStaking = ethers.utils.parseUnits("4392");
            const expectedCTH = ethers.utils.parseUnits("500");

            const ticketForStaking = await createStakingRewardTransferTicket(delegator1, 0);
            const ticketForCTH = await createCTHRewardTransferTicket(delegator2, expectedCTH);

            await expect(
                _RewardContract.connect(worker).metaClaimRewards({
                  ticketForStaking,
                  ticketForCTH
                })
            ).to.be.revertedWith('Reward: Invalid receiver');

            // After token balance
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(0);
            expect(await _FNCToken.balanceOf(delegator2.address)).to.equal(0);
        });

        it("Success: Get multiple users Staking Reward with CTH Reward(Meta tx / valid ticket)", async function () {
            // delegator1: Staking + CTH
            const expectedStaking1 = ethers.utils.parseUnits("4392");
            const expectedCTH1 = ethers.utils.parseUnits("500");
            const ticketForStaking1 = await createStakingRewardTransferTicket(delegator1, 0);
            const ticketForCTH1 = await createCTHRewardTransferTicket(delegator1, expectedCTH1);

            // delegator2: Staking only (CTH ticket has not signatures.)
            const expectedStaking2 = ethers.utils.parseUnits("4392");
            const expectedCTH2 = 0;
            const ticketForStaking2 = await createStakingRewardTransferTicket(delegator2, 0);
            const ticketForCTH2 = {...ZeroCTHRewardTransferTicket, ...{ accumulatedAmount: expectedCTH2 }};

            // delegator3: CTH only (Staking ticket has not signatures.)
            const expectedStaking3 = 0;
            const expectedCTH3 = ethers.utils.parseUnits("300");
            const ticketForStaking3 = {...ZeroStakingRewardTransferTicket, ...{ amount: 0 }};
            const ticketForCTH3 = await createCTHRewardTransferTicket(delegator3, expectedCTH3);

            await expect(
                _RewardContract.connect(worker).metaClaimRewardsWithList([
                  { ticketForStaking: ticketForStaking1, ticketForCTH: ticketForCTH1 },
                  { ticketForStaking: ticketForStaking2, ticketForCTH: ticketForCTH2 },
                  { ticketForStaking: ticketForStaking3, ticketForCTH: ticketForCTH3 },
                ])
            ).not.to.be.reverted

            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expectedStaking1.add(expectedCTH1));
            expect(await _FNCToken.balanceOf(delegator2.address)).to.equal(expectedStaking2);
            expect(await _FNCToken.balanceOf(delegator3.address)).to.equal(expectedCTH3);
        });

        it('Exploit: #2/QSP-5 Denial of Service on Ticket System / CTH', async () => {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expectedStaking = ethers.utils.parseUnits("4392");
            const expectedCTH = ethers.utils.parseUnits("500");

            const ticketForStaking = await createStakingRewardTransferTicket(delegator1, 0);
            const ticketForCTH = await createCTHRewardTransferTicket(delegator1, expectedCTH);
            const zeroTicketForStaking = {...ZeroStakingRewardTransferTicket, ...{ amount: 0 }};

            // QSP-5 prevent receiving by other delegator
            ticketForCTH.receiver = constants.ZERO_ADDRESS;
            await expect(
              _RewardContract.connect(nobody).metaClaimRewards({
                  ticketForStaking: zeroTicketForStaking,
                  ticketForCTH: ticketForCTH
              })
            ).not.to.be.reverted

            // QSP-5
            ticketForCTH.receiver = delegator1.address
            await expect(
              _RewardContract.connect(worker).metaClaimRewards({
                  ticketForStaking: ticketForStaking,
                  ticketForCTH: ticketForCTH
              })
            ).not.to.be.reverted

            // After token balance
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expectedStaking.add(expectedCTH));
        });

        it('Exploit: #2/QSP-5 Denial of Service on Ticket System / Staking', async () => {
            // dailyReward * (myLock / totalLock) * (100% - commissionRate);
            // 17080 * 2000 / 7000 * 90% = 4392 tokens
            const expectedStaking = ethers.utils.parseUnits("4392");
            const expectedCTH = ethers.utils.parseUnits("500");

            const ticketForStaking = await createStakingRewardTransferTicket(delegator1, 0);
            const ticketForCTH = await createCTHRewardTransferTicket(delegator1, expectedCTH);
            const zeroTicketForCTH = {...ZeroCTHRewardTransferTicket, ...{ accumulatedAmount: 0 }};

            console.log(ticketForCTH);
            console.log(zeroTicketForCTH);

            // QSP-5 prevent receiving by other delegator
            ticketForStaking.receiver = constants.ZERO_ADDRESS;
            await expect(
              _RewardContract.connect(nobody).metaClaimRewards({
                  ticketForStaking: ticketForStaking,
                  ticketForCTH: zeroTicketForCTH
              })
            ).not.to.be.reverted

            // QSP-5
            ticketForStaking.receiver = delegator1.address
            await expect(
              _RewardContract.connect(worker).metaClaimRewards({
                  ticketForStaking: ticketForStaking,
                  ticketForCTH: ticketForCTH
              })
            ).not.to.be.reverted

            // After token balance
            expect(await _FNCToken.balanceOf(delegator1.address)).to.equal(expectedStaking.add(expectedCTH));
        });
    });
});
