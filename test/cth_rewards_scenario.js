const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { genInstantSigner } = require("./support/utils");
const { createCTHRewardTransferTicket } = require("./support/ticket");
const {deployAll} = require('./support/deploy');

describe("Whole CTH reward scenario with prod contract: Day0", function () {
    let _TimeContract, _FNCToken, _ValidatorContract, _VaultContract, _StakingContract, _LogFileHash, _RNG, _RewardContract;
    let owner, user1, user2, nobody, worker;

    beforeEach(async function() {
        [owner, user1, user2, nobody, worker] = await ethers.getSigners();
        const { TimeContract, FNCToken, ValidatorContract, VaultContract, StakingContract, LogFileHash, RNG, RewardContract } = await deployAll(false, owner);
        await VaultContract.setupStakingRole(StakingContract.address);
        await RewardContract.grantMetaTransactionWorker(worker.address);
        _TimeContract = TimeContract, _FNCToken = FNCToken, _ValidatorContract = ValidatorContract, _VaultContract = VaultContract,
            _StakingContract = StakingContract, _LogFileHash = LogFileHash, _RNG = RNG, _RewardContract = RewardContract;
    });

    it("Transfer pool and check size", async function () {
        const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000), "ether"));
        const refillSize = String(web3.utils.toWei(web3.utils.toBN(2000), "ether"));
        const current = Number(await _TimeContract.getCurrentTimeIndex());

        // Allocate initial rewards
        await expect(
            _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize)
        ).not.to.be.reverted;

        await expect(
            _RewardContract.connect(owner).supplyCTHPool(allocateSize)
        ).not.to.be.reverted;

        // Pool size for each days
        expect(await _RewardContract.getCTHPoolSize()).to.equal(allocateSize);

        // Refill rewards
        await expect(
            _FNCToken.connect(owner).approve(_RewardContract.address, refillSize)
        ).not.to.be.reverted;

        await expect(
            _RewardContract.connect(owner).supplyCTHPool(refillSize)
        ).not.to.be.reverted;

        // Pool size for each days
        expect(await _RewardContract.getCTHPoolSize()).to.equal(BigInt(allocateSize) + BigInt(refillSize));
    });

    describe("Step: After setup rewards pool", function () {
        beforeEach(async function() {
            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000), "ether"));
            const current = await _TimeContract.getCurrentTimeIndex();
            _FNCToken.connect(owner).mint(owner.address, allocateSize);
            _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize);
            _RewardContract.connect(owner).supplyCTHPool(allocateSize);
        });

        it("Success: Receive with valid signature(normal tx)", async function () {
            // month 1: 300
            // month 2: +200 / total 500
            // Test request1: accumulated amount=300 => receive 300 tokens
            // Test request2: accumulated amount=500 => receive 200 tokens
            const amount1 = ethers.utils.parseUnits("300");
            const ticket1 = await createCTHRewardTransferTicket(user1, amount1);
            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket1)
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(amount1);

            const amount2 = ethers.utils.parseUnits("500");
            const ticket2 = await createCTHRewardTransferTicket(user1, amount2);
            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket2)
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(amount2);
        });

        it("Success: Receive with valid signature with changing the order(normal tx)", async function () {
            // month 1: 300
            // month 2: +200 / total 500
            // Test request1: ticket for month2 => receive 500 tokens
            // Test request2: ticket for month1 => not fail, but receive 0 tokens
            const ticket1 = await createCTHRewardTransferTicket(user1, 300);
            const ticket2 = await createCTHRewardTransferTicket(user1, 500);
            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket2) // First: ticket '2'
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(500);

            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket1) // Second: ticket '1'
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(500);
        });

        it("Fail: Receive with falsified accumulatedAmount(normal tx)", async function () {
            // Test request: accumulated amount=300 => 500 => fail
            let falsifiedTicket = await createCTHRewardTransferTicket(user1, 300);
            falsifiedTicket.accumulatedAmount = 500;
            await expect(
              _RewardContract.connect(user1).claimCTHReward(falsifiedTicket)
            ).to.be.revertedWith('Reward: Invalid body signer');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Fail: Reuse receive with valid signature(normal tx)", async function () {
            // reuse ticket
            const ticket = await createCTHRewardTransferTicket(user1, 300);
            await expect(
              _RewardContract.connect(user1).claimCTHReward(ticket)
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(300);

            // transaction failed
            await expect(
              _RewardContract.connect(user1).claimCTHReward(ticket)
            ).to.be.revertedWith("Reward: Ticket had been already used");
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(300);
        });

        it("Success: Receive with receiver doesn't match(normal tx)", async function () {
            // month 1: 300
            // Test request1: accumulated amount=300 => user1 receives 300 tokens
            const amount = ethers.utils.parseUnits("300");
            const ticket = await createCTHRewardTransferTicket(user1, amount);
            await expect(
                _RewardContract.connect(nobody).claimCTHReward(ticket)
            ).to.be.revertedWith("Reward: Receiver is not msg.sender");
        });

        it("Success: Receive with valid signature(meta tx)", async function () {
            // month 1: 300
            // request1: accumulated amount=300 => user1 receives 300 tokens
            const amount = ethers.utils.parseUnits("300");
            const ticket = await createCTHRewardTransferTicket(user1, amount);
            await expect(
                _RewardContract.connect(worker).metaClaimCTHReward(ticket)
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(amount);
            expect(await _FNCToken.balanceOf(worker.address)).to.equal(0);
        });

        it("Fail: Receive with falsified accumulatedAmount(meta tx)", async function () {
            // Test request: accumulated amount=300 => 500 => fail
            let falsifiedTicket = await createCTHRewardTransferTicket(user1, 300);
            falsifiedTicket.accumulatedAmount = 500;
            await expect(
                _RewardContract.connect(user1).claimCTHReward(falsifiedTicket)
            ).to.be.revertedWith('Reward: Invalid body signer');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Fail: Receive with falsified receiver(meta tx)", async function () {
            // Test request: receiver=user1 => user2 => fail
            let falsifiedTicket = await createCTHRewardTransferTicket(user1, 300);
            falsifiedTicket.receiver = user2.address;
            await expect(
                _RewardContract.connect(user2).claimCTHReward(falsifiedTicket)
            ).to.be.revertedWith('Reward: Invalid body signer');
            expect(await _FNCToken.balanceOf(user2.address)).to.equal(0);
        });

        it("Fail: Reuse receive with valid signature(meta tx)", async function () {
            // reuse ticket
            const ticket = await createCTHRewardTransferTicket(user1, 300);
            await expect(
              _RewardContract.connect(worker).metaClaimCTHReward(ticket)
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(300);

            // transaction failed
            await expect(
              _RewardContract.connect(worker).metaClaimCTHReward(ticket)
            ).to.be.revertedWith("Reward: Ticket had been already used");
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(300);
        });

        it("Fail: Receive with invalid signature for instant key", async function () {
            // month 1: 300
            // request1: signature of body is wrong => revert
            const amount = ethers.utils.parseUnits("300");
            const ticket = await createCTHRewardTransferTicket(user1, amount);

            const { instantSigner: invalidInstantSigner } = genInstantSigner();
            const bodyHash = ethers.utils.solidityKeccak256(["bytes", "uint"], [user1.address, amount.toString()]);
            const invalidBodySignature = await invalidInstantSigner.signMessage(ethers.utils.arrayify(bodyHash));
            ticket.ticketSigner = invalidInstantSigner.address;
            ticket.bodySignature = invalidBodySignature;

            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket)
            ).to.be.revertedWith('Reward: Invalid head signer');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);

            await expect(
                _RewardContract.connect(worker).metaClaimCTHReward(ticket)
            ).to.be.revertedWith('Reward: Invalid head signer');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Fail: Receive with invalid signature for master key", async function () {
            // month 1: 300
            // request1: signature of head(signature of instant key) is wrong => revert
            const amount = ethers.utils.parseUnits("300");
            const ticket = await createCTHRewardTransferTicket(user1, amount, nobody);  // signed by not owner

            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket)
            ).to.be.revertedWith('Reward: Invalid head signer');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);

            await expect(
                _RewardContract.connect(worker).metaClaimCTHReward(ticket)
            ).to.be.revertedWith('Reward: Invalid head signer');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);
        });

        it("Success: Receive in the budget", async function () {
            // month 1: allocateSize
            // request1: accumulated amount=allocateSize => receive allocateSize tokens
            const amount = ethers.utils.parseUnits("10000");
            const ticket = await createCTHRewardTransferTicket(user1, amount);
            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket)
            ).not.to.be.reverted;
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(amount);
        });

        it("Fail: Receive over the budget", async function () {
            // month 1: allocateSize + 1
            // request1: accumulated amount=allocateSize + 1 => receive
            const amount = ethers.utils.parseUnits("10001");
            const ticket = await createCTHRewardTransferTicket(user1, amount);
            await expect(
                _RewardContract.connect(user1).claimCTHReward(ticket)
            ).to.be.revertedWith('Reward: Over budget of CTH rewards');
            expect(await _FNCToken.balanceOf(user1.address)).to.equal(0);
        });
    });
});
