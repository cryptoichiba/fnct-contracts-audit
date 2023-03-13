const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const {deployAll, deployTimeContract, deployVaultContract, deployValidatorContract} = require('./support/deploy');

describe("Validator", function () {

    beforeEach(async () => {
        [owner, validator1, nobody, operator] = await ethers.getSigners();

        _TimeContract = await deployTimeContract(3600, true, owner);
        _ValidatorContract = await deployValidatorContract(_TimeContract, false, owner);
    });

    it('Fail: Unrenounceable', async () => {
        await expect(
            _ValidatorContract.connect(owner).renounceOwnership()
        ).to.be.revertedWith("UnrenounceableOwnable: Can't renounce ownership");
    })

    it("Fail: Should not allow overwrite validator", async function() {
        // Success once
        await expect(
            _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 100000)
        ).not.to.be.reverted;

        // Fail after registration
        await expect(
            _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 100000)
        ).to.be.revertedWith("Validator: Validator is already registered");
    });

    describe("Add", async () => {
        it("Success: Owner can add a validator", async function() {
            await expect(
                _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5)
            ).to.emit(_ValidatorContract, 'ValidatorAdded');

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(true);
        });

        it("Fail: Non-owner can't add a validator", async function() {
            await expect(
                _ValidatorContract.connect(nobody).addValidator(validator1.address, '0x00', 10 ** 5)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(false);
        });
    });

    describe("Manage", async () => {
        beforeEach(async () => {
            await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5);
        });

        it('Success: Submitter', async () => {
            await expect(
              _ValidatorContract.connect(validator1).setSubmitter(operator.address)
            ).to.be.emit(_ValidatorContract, "SubmitterChanged").withArgs(validator1.address, operator.address);
        })

        it('Fail: Submitter is zero address', async () => {
            await expect(
              _ValidatorContract.connect(validator1).setSubmitter(ethers.constants.AddressZero)
            ).to.be.revertedWith("Validator: Submitter is zero address");
        })

        it('Fail: non-validator', async () => {
            await expect(
              _ValidatorContract.connect(nobody).setSubmitter(nobody.address)
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");
        })

        it('Fail: disabled validator', async () => {
            await expect(
              _ValidatorContract.connect(owner).disableValidator(validator1.address)
            ).to.emit(_ValidatorContract, 'ValidatorDisabled');

            await expect(
              _ValidatorContract.connect(validator1).setSubmitter(operator.address)
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");
        })

        it('Success: Receiver', async () => {
            await expect(
              _ValidatorContract.connect(validator1).setCommissionReceiver(operator.address)
            ).to.be.emit(_ValidatorContract, "ComissionReceiverChanged").withArgs(validator1.address, operator.address);
        })

        it('Fail: Receiver is zero address', async () => {
            await expect(
              _ValidatorContract.connect(validator1).setCommissionReceiver(ethers.constants.AddressZero)
            ).to.be.revertedWith("Validator: Receiver is zero address");
        })

        it('Fail: non-validator', async () => {
            await expect(
              _ValidatorContract.connect(nobody).setCommissionReceiver(nobody.address)
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");
        })

        it('Fail: disabled validator', async () => {
            await expect(
              _ValidatorContract.connect(owner).disableValidator(validator1.address)
            ).to.emit(_ValidatorContract, 'ValidatorDisabled');

            await expect(
              _ValidatorContract.connect(validator1).setCommissionReceiver(operator.address)
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");
        })

        it('Success: updateCommissionRateCache', async () => {
            await expect(
              _ValidatorContract.connect(nobody).updateCommissionRateCache(1, validator1.address)
            ).to.be.emit(_ValidatorContract, "CachedComissionRateChanged").withArgs(nobody.address, validator1.address, 1, 100000);
        })

        it("Success: Owner can disable a validator", async function() {
            await expect(
                _ValidatorContract.connect(owner).disableValidator(validator1.address)
            ).to.emit(_ValidatorContract, 'ValidatorDisabled');

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(false);
        });

        it("Fail: Non-owner can't disable a validator", async function() {
            await expect(
                _ValidatorContract.connect(nobody).disableValidator(validator1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(true);
        });

        it("Success: Validator can update stats", async function() {
            // Initial value
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(100000);

            // Still 100000
            validator = await _ValidatorContract.getValidator(validator1.address)
            await expect(validator["data"]).to.equal("0x00");
            await expect(validator["commission"]).to.equal(ethers.BigNumber.from(100000));

            // Before changed
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(0));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(0));

            // Try to change
            await expect(
                _ValidatorContract.connect(validator1).updateValidator(120000, "0x01")
            ).not.to.be.reverted;

            // Pending 7 days - still 100000
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(100000);

            // Scheduled commission rate
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(7));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(120000));

            // Changed immediately
            validator = await _ValidatorContract.getValidator(validator1.address)
            await expect(validator["data"]).to.equal("0x01");
            await expect(validator["commission"]).to.equal(ethers.BigNumber.from(100000));

            // Try to change
            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(200000)
            ).not.to.be.reverted;

            // Pending 7 days - still 100000
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(100000);

            // Scheduled commission rate
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(7));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(200000));

            // Try to change
            await expect(
                _ValidatorContract.connect(validator1).updateDetail("0x02")
            ).not.to.be.reverted;

            // Changed immediately
            validator = await _ValidatorContract.getValidator(validator1.address)
            await expect(validator["data"]).to.equal("0x02");
            await expect(validator["commission"]).to.equal(ethers.BigNumber.from(100000));

            // Pending 7 days - still 100000
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(100000);

            // Scheduled commission rate
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(7));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(200000));

            await _TimeContract.setCurrentTimeIndex(7);

            // Still scheduled
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(7));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(200000));

            // Still 100000
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(100000);

            // Still 100000
            validator = await _ValidatorContract.getValidator(validator1.address)
            await expect(validator["data"]).to.equal("0x02");
            await expect(validator["commission"]).to.equal(ethers.BigNumber.from(100000));

            await _TimeContract.setCurrentTimeIndex(8);

            // Changed
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(200000);

            // Changed
            validator = await _ValidatorContract.getValidator(validator1.address)
            await expect(validator["data"]).to.equal("0x02");
            await expect(validator["commission"]).to.equal(ethers.BigNumber.from(200000));

            // No longer scheduled
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(0));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(0));

            // Try to change
            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(180000)
            ).not.to.be.reverted;

            // Scheduled commission rate
            scheduled = await _ValidatorContract.getScheduledCommissionRate(validator1.address)
            await expect(scheduled[0]).to.equal(ethers.BigNumber.from(15));
            await expect(scheduled[1]).to.equal(ethers.BigNumber.from(180000));

            // Still 200000
            await expect(
                await _ValidatorContract.getCommissionRate(validator1.address)
            ).to.equal(200000);
        });

        it("Success: In valid commission range", async function() {
            await expect(
                _ValidatorContract.connect(validator1).updateValidator(50000, "0x01")
            ).not.to.be.reverted;

            await expect(
                _ValidatorContract.connect(validator1).updateValidator(990000, "0x01")
            ).not.to.be.reverted;

            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(50000)
            ).not.to.be.reverted;

            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(990000)
            ).not.to.be.reverted;
        });

        it("Fail: Invalid commission range", async function() {
            await expect(
                _ValidatorContract.connect(validator1).updateValidator(49999, "0x01")
            ).to.be.revertedWith("Validator: Commission rate is out of range");

            await expect(
                _ValidatorContract.connect(validator1).updateValidator(990001, "0x01")
            ).to.be.revertedWith("Validator: Commission rate is out of range");

            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(49999)
            ).to.be.revertedWith("Validator: Commission rate is out of range");

            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(990001)
            ).to.be.revertedWith("Validator: Commission rate is out of range");
        });

        it("Success: Can set commission rate range in valid range", async function() {
            await expect(
                _ValidatorContract.connect(owner).setCommissionRateRange(1, 990000)
            ).not.to.be.reverted;

            await expect(
                _ValidatorContract.connect(owner).setCommissionRateRange(1, 50000)
            ).not.to.be.reverted;
        });

        it("Fail: Can't set commission rate range out of range", async function() {
            await expect(
                _ValidatorContract.connect(owner).setCommissionRateRange(1, 990001)
            ).to.be.revertedWith("Validator: Max commission rate should be equal or less than 99%");
        });

        it("Fail: Can't set max commission rate less than min", async function() {
            await expect(
                _ValidatorContract.connect(owner).setCommissionRateRange(101, 100)
            ).to.be.revertedWith("Validator: Max commission rate should be equal or less than min");
        });

        it("Fail: Non-owner can't update commission rate range", async function() {
            await expect(
                _ValidatorContract.connect(nobody).setCommissionRateRange(1, 1000)
            ).to.be.revertedWith("Ownable: caller is not the owner");
        });

        it("Fail: Non-validator can't update stats", async function() {
            await expect(
                _ValidatorContract.connect(owner).updateValidator(100, [])
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");

            await expect(
                _ValidatorContract.connect(nobody).updateValidator(100, [])
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");
        });

        it("Fail: Non-owner can't disable a validator", async function() {
            await expect(
                _ValidatorContract.connect(nobody).disableValidator(validator1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(true);
        });

        it("Repro: Broken cachedSubmissionRate", async function() {
            await _TimeContract.setCurrentTimeIndex(1);

            // Initial value
            result = await _ValidatorContract.getCommissionRateOfDay(1, validator1.address)
            await expect(result).to.equal(ethers.BigNumber.from(100000));

            await expect(
              _ValidatorContract.connect(validator1).updateValidator(50000, "0x01")
            ).not.to.be.reverted;

            await _TimeContract.setCurrentTimeIndex(10);

            // Updated
            result = await _ValidatorContract.getCommissionRateOfDay(10, validator1.address)
            await expect(result).to.equal(ethers.BigNumber.from(50000));

            await expect(
              _ValidatorContract.connect(validator1).updateValidator(150000, "0x01")
            ).not.to.be.reverted;

            await _TimeContract.setCurrentTimeIndex(15);

            // Scheduled but not available yet
            result = await _ValidatorContract.getCommissionRateOfDay(15, validator1.address)
            // await expect(result).to.equal(ethers.BigNumber.from(100000)); // Under the #2/QSP-4 repro code
            await expect(result).to.equal(ethers.BigNumber.from(50000));
        });

        it("Repro: Broken cachedSubmissionRate", async function() {
            await _TimeContract.setCurrentTimeIndex(1);

            // Initial value
            result = await _ValidatorContract.getCommissionRateOfDay(1, validator1.address)
            await expect(result).to.equal(ethers.BigNumber.from(100000));

            await expect(
              _ValidatorContract.connect(validator1).updateCommissionRate(50000)
            ).not.to.be.reverted;

            await _TimeContract.setCurrentTimeIndex(10);

            // Updated
            result = await _ValidatorContract.getCommissionRateOfDay(10, validator1.address)
            await expect(result).to.equal(ethers.BigNumber.from(50000));

            await expect(
              _ValidatorContract.connect(validator1).updateCommissionRate(150000)
            ).not.to.be.reverted;

            await _TimeContract.setCurrentTimeIndex(15);

            // Scheduled but not available yet
            result = await _ValidatorContract.getCommissionRateOfDay(15, validator1.address)
            // await expect(result).to.equal(ethers.BigNumber.from(100000)); // Under the #2/QSP-4 repro code
            await expect(result).to.equal(ethers.BigNumber.from(50000));
        });
    });

    describe("Manage disabled validator", async () => {
        beforeEach(async () => {
            await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 100000);
            await _ValidatorContract.connect(owner).disableValidator(validator1.address);
        });

        it("Success: Owner can enable a validator", async function() {
            await expect(
                _ValidatorContract.connect(owner).enableValidator(validator1.address)
            ).to.emit(_ValidatorContract, 'ValidatorEnabled');

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(true);
        });

        it("Fail: Non-owner can't enable a validator", async function() {
            await expect(
                _ValidatorContract.connect(nobody).enableValidator(validator1.address)
            ).to.be.revertedWith("Ownable: caller is not the owner");

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(false);
        });

        it("Fail: Disabled validator can't update stats", async function() {
            await expect(
                _ValidatorContract.connect(validator1).updateValidator(100, [])
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");

            await expect(
                _ValidatorContract.connect(validator1).updateDetail([])
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");

            await expect(
                _ValidatorContract.connect(validator1).updateCommissionRate(100)
            ).to.be.revertedWith("Validator: Caller is not validator or disabled");
        });

        it("Fail: Can't disable a validator again", async function() {
            await expect(
                _ValidatorContract.connect(owner).disableValidator(validator1.address)
            ).to.be.revertedWith("Validator: Validator had been already disabled");

            await expect(
                await _ValidatorContract.checkIfExist(validator1.address)
            ).to.equal(false);
        });

        it("Exploit: #2/QSP-14 Should not allow overwrite disabled validator", async function() {
            await expect(
                _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 100000)
            ).to.be.revertedWith("Validator: Validator is already registered");
        });
    });

});
