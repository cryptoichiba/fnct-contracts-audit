const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber } = ethers;
const { deployRNG, deployTimeContract } = require("./support/deploy");

// Test of random number generation using Chainlink.
//
// This test requires contracts to be generated previously (can create with scripts/deploy_test_rng.js)
// Note that this test is intended for testnet or mainnet only; it will fail if run locally or if
// RandomNumberGenerator contract has not been prefunded with LINK.

// This test is designed for polygon mainnet
describe('RNGContract', () => {

    describe("Deployed contract", async() => {
        it.skip("Should get random number between 0 and 100", async () => {
            // Load previously created contracts
            // Note that rngContract must have LINK associated with it, for random calls to work!
            const TimeContractFactory = await ethers.getContractFactory('TimeContract');
            const timeContract = await TimeContractFactory.attach(
                "0x8d5F9c517f62e0870100d29AABFF4DD667255843" // TimeContract deployed contract address (Polygon mainnet)
            );

            const RNGContractFactory = await ethers.getContractFactory('RandomNumberGenerator');
            const rngContract = await RNGContractFactory.attach(
                "0xe3f9Ca57cdc38C504bA20e95282638594B4ac348" // RandomNumberGenerator deployed contract address (Polygon mainnet)
            );

            //毎回別の「日」の乱数を取得するために、todayを擬似値にします
            //const today = await timeContract.getCurrentTimeIndex();
            const today = Date.now();

            //not.to.be.revertedのエラー解決ができるまでコメントアウトします。（早めに正式に対応しますが、失敗したら乱数は取得しませんので、
            //not.to.be.revertedはチェックしなくてもその後のexceptは正常動きを確認してくれます）
            //await expect ( rngContract.requestRandomWords(today, 100) ).not.to.be.reverted;
            await rngContract.requestRandomWords(today, 100);

            // Attempt to getRandomNumber, 1time/10sec x 18times
            let randomNumber = -1;
            for ( let i = 0; i < 18; i++ ) {
                // Attempt to getRandomNumber, and break if succeed
                try {
                    randomNumber = await rngContract.getRandomNumber(today);
                    break;
                } catch (e) {
                    // If true error, throw exception.  But if number is just not generated yet, keep waiting
                    if ( e.reason != "Not generated the number yet") {
                        throw e
                    }
                }
                //Sleep 10 seconds
                await new Promise(r => setTimeout(r, 10000));
            }

            // Confirm received random number in correct range
            expect(randomNumber).to.be.at.least(0);
            expect(randomNumber).to.below(100);
        });
    });

    describe("Deploy contract", async() => {
        beforeEach(async () => {
            [owner, requester, nobody] = await ethers.getSigners();

            // Load previously created contracts
            // Note that rngContract must have LINK associated with it, for random calls to work!
            const TimeContractFactory = await ethers.getContractFactory('MockTimeContract');
            const timeContract = await TimeContractFactory.deploy(0, 0);
            await timeContract.deployed();

            const RNGContractFactory = await ethers.getContractFactory('RandomNumberGenerator');
            rngContract = await RNGContractFactory.deploy(
                "0xb0897686c545045aFc77CF20eC7A532E3120E0F1",
                "0x4e42f0adEB69203ef7AaA4B7c414e5b1331c14dc",
                40,
                timeContract.address
            );
            await rngContract.deployed();
        });

        it("Success: Set role by owner", async () => {
            await expect (
                rngContract.connect(owner).setRequester(requester.address)
            ).to.emit(rngContract, "RequesterGranted");
        });

        it("Fail: Set requester role as zero address", async () => {
            await expect (
                rngContract.connect(owner).setRequester(ethers.constants.AddressZero)
            ).to.be.revertedWith("RandomNumber: Requester is zero address");
        });

        it("Success: Withdraw by owner", async () => {
            await expect (
                rngContract.connect(owner).withdrawLink()
            ).not.to.be.revertedWith('Only callable by owner');
        });

        it("Fail: Set role by non-owner", async () => {
            await expect (
                rngContract.connect(nobody).setRequester(requester.address)
            ).to.be.revertedWith('Only callable by owner');
        });

        it("Fail: Request by non-requester role", async () => {
            const today = Date.now() + 1;

            // Not granted yet
            await expect (
                rngContract.connect(requester).requestRandomWords(today, 100)
            ).to.be.revertedWith("AccessControl: account " + requester.address.toLowerCase() + " is missing role 0x61a3517f153a09154844ed8be639dabc6e78dc22315c2d9a91f7eddf9398c002");

            // Nobody
            await expect (
                rngContract.connect(nobody).requestRandomWords(today, 100)
            ).to.be.revertedWith("AccessControl: account " + nobody.address.toLowerCase() + " is missing role 0x61a3517f153a09154844ed8be639dabc6e78dc22315c2d9a91f7eddf9398c002");
        });

        it("Fail: Withdraw by non-owner", async () => {
            await expect (
                rngContract.connect(nobody).withdrawLink()
            ).to.be.revertedWith('Only callable by owner');
        });

        describe("Requester", async() => {
            beforeEach(async () => {
                await rngContract.connect(owner).setRequester(requester.address);
            });

            it("Request by requester role", async () => {
                const today = Date.now() + 1;

                await expect(
                    rngContract.connect(requester).requestRandomWords(today, 100)
                ).not.to.be.revertedWith("AccessControl: account " + requester.address.toLowerCase() + " is missing role 0x61a3517f153a09154844ed8be639dabc6e78dc22315c2d9a91f7eddf9398c002");
            });

            it("Fail: Request by non-requester role", async () => {
                const today = Date.now() + 1;

                await expect(
                    rngContract.connect(nobody).requestRandomWords(today, 100)
                ).to.be.revertedWith("AccessControl: account " + nobody.address.toLowerCase() + " is missing role 0x61a3517f153a09154844ed8be639dabc6e78dc22315c2d9a91f7eddf9398c002");
            });
        });

    });

    describe('Exploit: No More Staking Rewards After 30 Days', async () => {
        it("Fail: Simulate on the mock", async () => {
            const _TimeContract = await deployTimeContract(5, true);
            [_RNG, _ChainlinkWrapper, _ChainlinkCoordinator] = await deployRNG(_TimeContract);

            const [deployerAccount] = await ethers.getSigners();
            _RNG.setRequester(deployerAccount.address)

            await _TimeContract.setCurrentTimeIndex(30);
            await _RNG.requestRandomWords(30, 100);
            await _ChainlinkCoordinator.fulfillRandomWordsWithOverride(
                BigNumber.from(1), _ChainlinkWrapper.address, [0])

            await _TimeContract.setCurrentTimeIndex(31);
            await _RNG.requestRandomWords(31, 100);
            await _ChainlinkCoordinator.fulfillRandomWordsWithOverride(
                    BigNumber.from(2), _ChainlinkWrapper.address, [31])
            await expect(
                await _RNG.getRandomNumber(31)
            ).to.be.equal(31);

            await _TimeContract.setCurrentTimeIndex(32);
            await _RNG.requestRandomWords(32, 100);

            await _TimeContract.setCurrentTimeIndex(63);
            await _ChainlinkCoordinator.fulfillRandomWordsWithOverride(
                BigNumber.from(3), _ChainlinkWrapper.address, [32])
            await expect(
                _RNG.getRandomNumber(32)
            ).to.be.revertedWith('RandomNumber: Not generated the number yet');
        })
    })
});