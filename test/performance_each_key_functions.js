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

// Usage:
//   remove .skip
//   exec command: CI=true REPORT_GAS=1 npx hardhat test test/performance_each_key_functions.js
//   eval gas usages, especially about key functions [submit/lockAndDelegate/unlock/claimReward/claimStakingCommission]
//   change the numbers of the below constants and re-run command, then eval gas usage of key functions difference against the diff of each constants
describe.skip("Performance: Pattern of increasing number of delegators/lock/unlock/submission/running days", () => {
    const num_users = 1;
    const call_lock_per_user = 1000;
    const call_lock_per_other_user = 1;
    const call_unlock_per_user = 1000;
    const call_unlock_per_other_user = 1;
    const submit_per_day = 1;
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

        let validator = sample(validators).address;

        // other's lock: lock call_unlock_per_other_user * call_lock_per_other_user
        for (let i = 1; i < users.length; i++) {
            await FNCToken.mint(users[i].address, call_lock_per_other_user * call_unlock_per_other_user);
            await FNCToken.connect(users[i]).approve(VaultContract.address, call_lock_per_other_user * call_unlock_per_other_user);
            for (let j = 0; j < call_lock_per_other_user; j++ ) {
                await StakingContract.connect(users[i]).lockAndDelegate(call_unlock_per_other_user, validator);
            }
        }

        // self lock: lock call_unlock_per_user * call_lock_per_user
        await FNCToken.mint(users[0].address, call_lock_per_user * call_unlock_per_user);
        await FNCToken.connect(users[0]).approve(VaultContract.address, call_lock_per_user * call_unlock_per_user);
        for (let j = 0; j < call_lock_per_user; j++ ) {
            await StakingContract.connect(users[0]).lockAndDelegate(call_unlock_per_user, validator);
        }

        await TimeContract.setCurrentTimeIndex(181);

        // other's unlock: call_lock_per_other_user * call_unlock_per_other_user
        for (let i = 1; i < users.length; i++) {
            for (let j = 0; j < call_unlock_per_other_user; j++ ) {
                await StakingContract.connect(users[i]).unlock(call_lock_per_other_user);
            }
        }

        // self unlock: call_lock_per_user * call_unlock_per_user
        for (let j = 0; j < call_unlock_per_user; j++ ) {
            await StakingContract.connect(users[0]).unlock(call_lock_per_user);
        }

        // other's additional lock: 1 * call_lock_per_other_user
        for (let i = 1; i < users.length; i++) {
            await FNCToken.mint(users[i].address, call_lock_per_other_user);
            await FNCToken.connect(users[i]).approve(VaultContract.address, call_lock_per_other_user);
            for (let j = 1; j < call_lock_per_other_user; j++ ) {
                await StakingContract.connect(users[i]).lockAndDelegate(1, validator);
            }
        }

        // self additional lock: 1 * call_lock_per_user
        await FNCToken.mint(users[0].address, call_lock_per_user);
        await FNCToken.connect(users[0]).approve(VaultContract.address, call_lock_per_user);
        for (let j = 1; j < call_lock_per_user; j++ ) {
            await StakingContract.connect(users[0]).lockAndDelegate(1, validator);
        }
    })

    it.only("User call getStakingReward", async () => {
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

        let validator = validators[0].address;

        // other's lock: call_unlock_per_other_user * call_lock_per_other_user + 1
        for (let i = 1; i < users.length; i++) {
            await FNCToken.mint(users[i].address, call_lock_per_other_user * call_unlock_per_other_user + 1);
            await FNCToken.connect(users[i]).approve(VaultContract.address, call_lock_per_other_user * call_unlock_per_other_user + 1);
            await StakingContract.connect(users[i]).lockAndDelegate(1, validator);
            for (let j = 0; j < call_lock_per_other_user; j++ ) {
                await StakingContract.connect(users[i]).lockAndDelegate(call_unlock_per_other_user, validator);
            }
        }

        // self lock: call_unlock_per_user * call_lock_per_user + 1
        await FNCToken.mint(users[0].address, call_lock_per_user * call_unlock_per_user + 1);
        await FNCToken.connect(users[0]).approve(VaultContract.address, call_lock_per_user * call_unlock_per_user + 1);
        await StakingContract.connect(users[0]).lockAndDelegate(1, validator);
        for (let j = 0; j < call_lock_per_user; j++ ) {
            await StakingContract.connect(users[0]).lockAndDelegate(call_unlock_per_user, validator);
        }

        await TimeContract.setCurrentTimeIndex(181);

        // other's unlock call_lock_per_user * call_unlock_per_user
        for (let i = 1; i < users.length; i++) {
            for (let j = 0; j < call_unlock_per_other_user; j++ ) {
                await StakingContract.connect(users[i]).unlock(call_lock_per_other_user);
            }
        }

        // self unlock call_lock_per_user * call_unlock_per_user
        for (let j = 0; j < call_unlock_per_user; j++ ) {
            await StakingContract.connect(users[0]).unlock(call_lock_per_user);
        }

        for ( let day = 0; day < days; day++ ) {
            // File hash
            const file0 = web3.utils.hexToBytes("0xabcdabcd" + String(day));
            const file1 = web3.utils.hexToBytes("0xabcdabcd" + String(day+1));
            const file2 = web3.utils.hexToBytes("0xabcdabcd" + String(day+2));

            await TimeContract.setCurrentTimeIndex(181 + day);

            if ( day == 0 ) {
                console.log(day);
                for ( let i = 0; i < submit_per_day; i++ ) {
                    await LogFileHash.connect(validators[0]).submit(validators[0].address, day, file0, file1);
                    await LogFileHash.connect(validators[1]).submit(validators[1].address, day, file0, file1);
                    await LogFileHash.connect(validators[2]).submit(validators[2].address, day, file0, file1);
                }
            } else {
                console.log(day);
                // first submission
                await LogFileHash.connect(validators[0]).submit(validators[0].address, day - 1, file0, file1);
                await LogFileHash.connect(validators[1]).submit(validators[1].address, day, file1, file2);
                await LogFileHash.connect(validators[2]).submit(validators[2].address, day, file1, file2);

                // after first submission
                for ( let i = 0; i < submit_per_day - 1; i++ ) {
                    await LogFileHash.connect(validators[0]).submit(validators[0].address, day, file1, file2);
                    await LogFileHash.connect(validators[1]).submit(validators[1].address, day, file1, file2);
                    await LogFileHash.connect(validators[2]).submit(validators[2].address, day, file1, file2);
                }

                // Gen previous day's seed (Request ID is (day-1)+1 ( VRFCoordinatorV2Mock.sol assigns IDs [1,2,3...] )
                await ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                    BigNumber.from(day), ChainlinkWrapper.address, [0])

                // await LogFileHash.getMajority(day - 1);
            }
        }

        // first delegator / validator
        // claim function will provide 45 days reward/commission at once
        // the test contains 180 + days scenario
        // therefore, (180 + days) / 45 times claim required for receiving whole rewards/commission
        for ( let j = 0; j < (180 + days) / 45 + 1; j++ ) {
            await RewardContract.connect(users[0]).claimStakingReward();
            await RewardContract.connect(validators[0]).claimStakingCommission(validators[0].address);
            console.log("FNCT Balance / user:       " + ethers.utils.formatEther(await FNCToken.balanceOf(users[0].address)));
            console.log("FNCT Balance / validator:  " + ethers.utils.formatEther(await FNCToken.balanceOf(validators[0].address)));
        }
    })
});
