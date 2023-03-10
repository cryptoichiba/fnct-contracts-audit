const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { program } = require('commander');
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { BigNumber } = ethers;
const { deployAll } = require("./support/deploy");
const { genUsers, sample } = require("./support/utils");

const deployFixture = async () => {
    const [owner, validator1, validator2, validator3, suppliyer] = await ethers.getSigners();

    const {
        FNCToken,
        ValidatorContract,
        VaultContract,
        StakingContract,
        TimeContract,
        LogFileHash,
        RNG,
        ChainlinkWrapper,
        ChainlinkCoordinator,
        RewardContract
    } = await deployAll(false, owner);

    await ValidatorContract.addValidator(validator1.address, "0x00", 100000);
    await ValidatorContract.addValidator(validator2.address, "0x00", 150000);
    await ValidatorContract.addValidator(validator3.address, "0x00", 200000);

    await VaultContract.setupStakingRole(StakingContract.address);

    return {
        owner,
        validators: [validator1, validator2, validator3],
        suppliyer,
        FNCToken,
        ValidatorContract,
        VaultContract,
        StakingContract,
        TimeContract,
        LogFileHash,
        RNG,
        ChainlinkWrapper,
        ChainlinkCoordinator,
        RewardContract
    };
};

describe("Performance: Pattern of increasing number of users", () => {
    const num_users = 10;
    const days = 3; // More than 2

    it("User call lockAndDelegate", async () => {
        const {
            suppliyer,
            validators,
            FNCToken,
            VaultContract,
            StakingContract
        } = await loadFixture(deployFixture);

        const users = await genUsers(num_users, suppliyer);

        for (let i = 0; i < users.length; i++) {
            await FNCToken.mint(users[i].address, 1);
            await FNCToken.connect(users[i]).approve(VaultContract.address, 1);
            await StakingContract.connect(users[i]).lockAndDelegate(1, sample(validators).address);
        }
    })

    it("User call unlock", async () => {
        const {
            suppliyer,
            validators,
            FNCToken,
            VaultContract,
            StakingContract,
            TimeContract
        } = await loadFixture(deployFixture);

        const users = await genUsers(num_users, suppliyer);

        await TimeContract.setCurrentTimeIndex(0);

        for (let i = 0; i < users.length; i++) {
            await FNCToken.mint(users[i].address, 1);
            await FNCToken.connect(users[i]).approve(VaultContract.address, 1);
            await StakingContract.connect(users[i]).lockAndDelegate(1, sample(validators).address);
        }

        await TimeContract.setCurrentTimeIndex(181);

        for (let i = 0; i < users.length; i++) {
            await StakingContract.connect(users[i]).unlock(1);
        }
    })

    it("User call getStakingReward", async () => {
        const {
            owner,
            suppliyer,
            validators,
            FNCToken,
            VaultContract,
            StakingContract,
            TimeContract,
            LogFileHash,
            RNG,
            ChainlinkWrapper,
            ChainlinkCoordinator,
            RewardContract
        } = await loadFixture(deployFixture);

        const users = await genUsers(num_users, suppliyer);

        const allocateSize = String(web3.utils.toWei(web3.utils.toBN(10000000), "ether"));
        await FNCToken.mint(owner.address, allocateSize);
        await FNCToken.connect(owner).approve(RewardContract.address, allocateSize)
        await RewardContract.connect(owner).supplyStakingPool(1, allocateSize);

        for ( let i = 0; i < users.length; i++ ) {
            await FNCToken.mint(users[i].address, 1);
            await FNCToken.connect(users[i]).approve(VaultContract.address, 1);
            await StakingContract.connect(users[i]).lockAndDelegate(1, validators[0].address);
        }

        for ( let day = 0; day < days; day++ ) {
            // File hash
            const file0 = web3.utils.hexToBytes("0xabcdabcd" + String(day));
            const file1 = web3.utils.hexToBytes("0xabcdabcd" + String(day+1));
            const file2 = web3.utils.hexToBytes("0xabcdabcd" + String(day+2));

            await TimeContract.setCurrentTimeIndex(day);

            if ( day == 0 ) {
                await LogFileHash.connect(validators[0]).submit(validators[0].address, day, file0, file1);
                await LogFileHash.connect(validators[1]).submit(validators[1].address, day, file0, file1);
                await LogFileHash.connect(validators[2]).submit(validators[2].address, day, file0, file1);
            } else {
                await LogFileHash.connect(validators[0]).submit(validators[0].address, day - 1, file0, file1);
                await LogFileHash.connect(validators[1]).submit(validators[1].address, day, file1, file2);
                await LogFileHash.connect(validators[2]).submit(validators[2].address, day, file1, file2);

                // Gen previous day's seed (Request ID is (day-1)+1 ( VRFCoordinatorV2Mock.sol assigns IDs [1,2,3...] )
                await ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                    BigNumber.from(day), ChainlinkWrapper.address, [0])

                await LogFileHash.getMajority(day - 1);
            }
        }

        for ( let i = 0; i < 1; i++ ) {
            for ( let j = 0; j < 5; j++ ) {
                await RewardContract.connect(users[i]).claimStakingReward();
                await RewardContract.connect(validators[0]).claimStakingCommission(validators[0].address);
                console.log("FNCT Balance / user:       " + ethers.utils.formatEther(await FNCToken.balanceOf(users[i].address)));
                console.log("FNCT Balance / validator:  " + ethers.utils.formatEther(await FNCToken.balanceOf(validators[0].address)));
            }
        }
    })
});
