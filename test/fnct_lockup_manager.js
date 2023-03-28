const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { BigNumber } = ethers;
const { deployAll, deployFNCToken } = require('./support/deploy');
const { genUsers, sample } = require("./support/utils");
const {indexToDouble} = require('truffle/build/791.bundled');

describe("FCNT Lockup Manager", function () {
    beforeEach(async function() {
        [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, reclaim, nobody] = await ethers.getSigners();
        _FNCToken = await deployFNCToken();

        // Target contract
        const FNCTLockupManager = await ethers.getContractFactory('FNCTLockupManager');
        _FNCTLockupManager = await FNCTLockupManager.deploy(
            _FNCToken.address,
            reclaim.address
        );
        await _FNCTLockupManager.deployed();

        addresses = [];
        addresses1 = [];
        addresses2 = [];
        addresses3 = [];
        addresses4 = [];
        addresses5 = [];
        num_50000_tokens = [];
        num_25000_tokens = [];

        // Initialize users
        let window = 10;
        users = await genUsers(window * 5, owner, ethers.utils.parseEther("10000"));

        for ( let i = 0; i < window; i++ ) {
            addresses1.push(users[i].address);
            addresses2.push(users[i+window].address);
            addresses3.push(users[i+window * 2].address);
            addresses4.push(users[i+window * 3].address);
            addresses5.push(users[i+window * 4].address);
        }

        // join intto one array
        addresses = addresses1.concat(addresses2.concat(addresses3.concat(addresses4.concat(addresses5))));

        for ( let i = 0; i < addresses.length; i++ ) {
            num_50000_tokens.push(ethers.utils.parseEther("50000"));
            num_25000_tokens.push(ethers.utils.parseEther("25000"));
        }

        // 5回に分割して発行
        await _FNCTLockupManager.deployLockup(addresses1);
        await _FNCTLockupManager.deployLockup(addresses2);
        await _FNCTLockupManager.deployLockup(addresses3);
        await _FNCTLockupManager.deployLockup(addresses4);
        await _FNCTLockupManager.deployLockup(addresses5);

        // デプロイ済みコントラクトの個数チェック
        let count = await _FNCTLockupManager.getDeployedContractCount();
        expect(count).to.equal(users.length);

        // トークン発行
        await _FNCToken.mint(_FNCTLockupManager.address, ethers.utils.parseEther("5000000"));

        // アロケート
        await expect(
            _FNCTLockupManager.allocateTokens(addresses, num_50000_tokens)
        ).not.to.be.reverted;
    });

    function randomIndex() {
        return Math.floor(Math.random() * users.length);
    }

    const deployStakingContracts = async (index) => {
        const { TimeContract, ValidatorContract, VaultContract, StakingContract, LogFileHash, RNG,
            ChainlinkWrapper, ChainlinkCoordinator, RewardContract } = await deployAll(
            false,
            owner,
            {_FNCToken}
        );
        await VaultContract.setupStakingRole(StakingContract.address);
        _TimeContract = TimeContract, _ValidatorContract = ValidatorContract, _VaultContract = VaultContract,
            _StakingContract = StakingContract, _LogFileHash = LogFileHash, _RNG = RNG,
            _ChainlinkWrapper = ChainlinkWrapper, _ChainlinkCoordinator = ChainlinkCoordinator, _RewardContract = RewardContract;

        await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5);
        await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5);
        await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5);
    }

    const getDeployedContract = async (index) => {
        const NonCustodialLockup = await ethers.getContractFactory('NonCustodialLockup');
        let count = await _FNCTLockupManager.getDeployedContractCount();
        let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);
        return NonCustodialLockup.attach(contracts[index].deployedContract);
    }

    const claimTokens = async (index, value) => {
        let contract = await getDeployedContract(index);
        return contract.connect(users[index]).claimTokens(ethers.utils.parseEther(value));
    }

    const delegateAll = async () => {
        const NonCustodialLockup = await ethers.getContractFactory('NonCustodialLockup');
        let count = await _FNCTLockupManager.getDeployedContractCount();
        let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);
        for ( let i = 0; i < contracts.length; i++ ) {
            let contract = await NonCustodialLockup.attach(contracts[i].deployedContract);
            await contract.connect(users[i]).proxyDelegate(validator1.address);
        }
    }

    it("Fail: コントラクト設定前は失敗する", async function () {
        // トークン発行
        await _FNCToken.mint(_FNCTLockupManager.address, ethers.utils.parseEther("5000000"));
        await _FNCToken.approve(_FNCTLockupManager.address, ethers.utils.parseEther("5000000"));

        // ロックアップ失敗
        await expect(
            _FNCTLockupManager.lockupTokens(addresses)
        ).to.be.revertedWith("NonCustodialLockup: Not setup contract yet");

        // 退社済みトークン返却未動作
        let index = randomIndex();
        let contract = await getDeployedContract(index);
        await expect(
            contract.connect(reclaim).withdrawUnclaimedTokens()
        ).to.be.revertedWith("NonCustodialLockup: Not setup contract yet");

        // デリゲート失敗
        await expect(
            contract.connect(users[index]).proxyDelegate(validator1.address)
        ).to.be.revertedWith("NonCustodialLockup: Not setup contract yet");

        // ステーキング報酬受取失敗
        await expect(
            contract.connect(users[index]).proxyClaimStakingReward()
        ).to.be.revertedWith("NonCustodialLockup: Not setup contract yet");

        // ガバナンス投票失敗
        await expect(
            contract.connect(users[index]).proxyVote(1, [0])
        ).to.be.revertedWith("NonCustodialLockup: Not setup contract yet");
    });

    describe("Step: Day0", function () {
        const file0 = web3.utils.hexToBytes("0xabcdabcda0");
        const file1 = web3.utils.hexToBytes("0xabcdabcda1");
        const file2 = web3.utils.hexToBytes("0xabcdabcda2");
        const file3 = web3.utils.hexToBytes("0xabcdabcda3");

        beforeEach(async function() {
            await deployStakingContracts();

            // 時刻をDay0に設定
            await _TimeContract.setCurrentTimeIndex(0);

            // デプロイ済みのコントラクトを設定
            await expect(
                _FNCTLockupManager.setupStakingContracts(_StakingContract.address, _VaultContract.address, _RewardContract.address)
            ).not.to.be.reverted;

            // ガバナンスコントラクトをデプロイ
            const GovernanceContract = await ethers.getContractFactory('MockGovernance');
            _GovernanceContract = await GovernanceContract.deploy();

            // デプロイ済みのコントラクトを設定
            await expect(
                _FNCTLockupManager.setupGovernanceContract(_GovernanceContract.address)
            ).not.to.be.reverted;

            // Lockupコントラクト経由でロック
            await expect(
                _FNCTLockupManager.lockupTokens(addresses)
            ).not.to.be.reverted;

            // 報酬プール設定
            const allocateSize = String(web3.utils.toWei(web3.utils.toBN(1000000), "ether"));
            _FNCToken.mint(owner.address, allocateSize);

            // Allocate initial rewards
            await expect(
                _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize)
            ).not.to.be.reverted;

            await expect(
                _RewardContract.connect(owner).supplyStakingPool(1, allocateSize)
            ).not.to.be.reverted;
        });

        it("ロックアップ量はDay0時点で50000とみなされる(ステーキング通常仕様通り)", async function () {
            let count = await _FNCTLockupManager.getDeployedContractCount();
            let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

            // Day0時点でのロック量は0
            let index = randomIndex();
            await expect(Number(web3.utils.fromWei(String(
                await _StakingContract.calcLock(contracts[index].deployedContract)
            )))).to.equal(50000);
        });

        it("Success: Day0から退職処理ができる", async function () {
            let count = await _FNCTLockupManager.getDeployedContractCount();
            let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

            let index = randomIndex();
            let contract = await getDeployedContract(index);

            // 退職によるトークン放棄
            await expect(
                contract.connect(users[index]).unclaimTokens()
            ).not.to.be.reverted;
        });

        it("Fail: 退職前にトークンを回収できない", async function () {
            let count = await _FNCTLockupManager.getDeployedContractCount();
            let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

            let index = randomIndex();
            let contract = await getDeployedContract(index);

            // 退職前には回収できない
            await expect(
                contract.connect(reclaim).withdrawUnclaimedTokens()
            ).to.be.revertedWith("NonCustodialLockup: Not unclaimed yet");
        });

        it("Fail: Day0ではデリゲート先を選べない(ステーキング仕様との兼ね合い)", async function() {
            let index = randomIndex();
            let contract = await getDeployedContract(index);
            await expect(
                contract.connect(users[index]).proxyDelegate(validator1.address)
            ).to.be.revertedWith("Staking: You can't change a validator on the same day");
        });

        it("Success: ガバナンス参加できる", async function() {
            // 投票: 111番目の議案に却下
            let index = randomIndex();
            let contract = await getDeployedContract(index);
            await expect(
                contract.connect(users[index]).proxyVote(111, [])
            ).not.to.be.reverted;

            // 投票: 112番目の議案に1番選択
            await expect(
                contract.connect(users[index]).proxyVote(112, [1])
            ).not.to.be.reverted;

            // 投票: 113番目の議案に1/2/3番選択
            await expect(
                contract.connect(users[index]).proxyVote(113, [1, 2, 3])
            ).not.to.be.reverted;
        });

        describe("Step: Day1", function () {
            beforeEach(async function() {
                // 時刻をDay1に設定
                await _TimeContract.setCurrentTimeIndex(1);
                await delegateAll();
                await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1);
                await _LogFileHash.connect(validator2).submit(validator2.address, 0, file0, file1);
                await _LogFileHash.connect(validator3).submit(validator3.address, 0, file0, file1);
            });

            it("ロックアップ量はDay1時点ですべて反映されたとみなされる(ステーキング通常仕様通り)", async function() {
                let count = await _FNCTLockupManager.getDeployedContractCount();
                let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

                // Day1時点でのロック量は50000
                let index = randomIndex();
                await expect(Number(web3.utils.fromWei(String(
                    await _StakingContract.calcLock(contracts[index].deployedContract)
                )))).to.equal(50000);
            });

            it("Fail: 未べスティングでは受け取りに失敗する", async function() {
                // 50000受け取れない
                await expect( claimTokens(randomIndex(), "50000") ).to.be.revertedWith("NonCustodialLockup: Insufficient vested amount");
            });

            it("Fail: べスティング後もステーキングのロックにより受け取りに失敗する", async function() {
                // べスティング総量を25000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;
                // 1も受け取れない
                await expect( claimTokens(randomIndex(), "1") ).to.be.revertedWith("NonCustodialLockup: Requested amount exceeds unlockable");
            });

            it("Fail: Day1ではデリゲート先を選べる(ステーキング仕様との兼ね合い)", async function() {
                let index = randomIndex();
                let contract = await getDeployedContract(index);
                await expect(
                    contract.connect(users[index]).proxyDelegate(validator1.address)
                ).not.to.be.reverted;
            });

            it("Fail: 報酬受取りはできるが受け取れるトークンはまだない(ステーキング仕様通り)", async function() {
                let index = randomIndex();
                let contract = await getDeployedContract(index);

                // 受け取り
                await expect(
                    contract.connect(users[index]).proxyClaimStakingReward()
                ).not.to.be.reverted;

                // 残高チェック
                await expect(Number(web3.utils.fromWei(String(
                    await _FNCToken.balanceOf(addresses[index])
                )))).to.equal(0);
            });
        });

        describe("Step: Day2", function () {
            beforeEach(async function () {
                // 時刻をDay1に設定
                await _TimeContract.setCurrentTimeIndex(1);

                // バリデート
                await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1);
                await _LogFileHash.connect(validator2).submit(validator2.address, 0, file0, file1);
                await _LogFileHash.connect(validator3).submit(validator3.address, 0, file0, file1);

                // デリゲーション
                await delegateAll();

                // 時刻をDay2に設定
                await _TimeContract.setCurrentTimeIndex(2);

                // バリデート
                await _LogFileHash.connect(validator1).submit(validator1.address, 0, file0, file1);
                await _LogFileHash.connect(validator2).submit(validator2.address, 1, file1, file2);
                await _LogFileHash.connect(validator3).submit(validator3.address, 1, file1, file2);
                // Day 2 lottery results send
                // (Day 1 had no winner, since no submit()s occured on Day 0, so this is the first
                // random number request.
                // Hence, Request ID is 1 ( VRFCoordinatorV2Mock.sol assigns IDs [1,2,3...])
                await _ChainlinkCoordinator.connect(owner).fulfillRandomWordsWithOverride(
                    BigNumber.from(1), _ChainlinkWrapper.address, [0])
            });

            it("Success: 報酬受取りはでき、メンバーウォレットのトークン残高に反映される(ステーキング仕様通り)", async function() {
                let index = randomIndex();
                let contract = await getDeployedContract(index);

                // 受け取り
                await expect(
                    contract.connect(users[index]).proxyClaimStakingReward()
                ).not.to.be.reverted;

                // 残高チェック、Day1の報酬から手数料を引いて50人で割る
                // Daily報酬=1708
                // コミッションレート=10%
                expect(Number(web3.utils.fromWei(String(
                    await _FNCToken.balanceOf(addresses[index])
                )))).equal(1708 * (9 / 10) / 50);
            });

            it("退職処理後もステーキング報酬は受け取れるが、元本回収は誰もできない", async function () {
                let count = await _FNCTLockupManager.getDeployedContractCount();
                let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

                let index = randomIndex();
                let contract = await getDeployedContract(index);

                // 退職によるトークン放棄
                await expect(
                    contract.connect(users[index]).unclaimTokens()
                ).not.to.be.reverted

                // ステーキング報酬は受け取れる
                await expect(
                    contract.connect(users[index]).proxyClaimStakingReward()
                ).not.to.be.reverted;

                // 元本回収はできない(メンバー)
                await expect(
                    contract.connect(users[index]).claimTokens("1")
                ).to.be.revertedWith("NonCustodialLockup: Already unclaimed");

                // 元本回収メソッドを呼び出しても受け取れるトークンがないので失敗
                await expect(
                    contract.connect(reclaim).withdrawUnclaimedTokens()
                ).to.be.revertedWith("Staking: Amount is zero");

                // 180日たっていないため元本回収はできない(会社)
                await expect(Number(web3.utils.fromWei(String(
                    await _FNCToken.balanceOf(reclaim.address)
                )))).to.equal(0);
            });
        });

        describe("Step: Day180", function () {
            beforeEach(async function() {
                // 時刻をDay180に設定
                await _TimeContract.setCurrentTimeIndex(180);
            });

            it("Fail: 未べスティングでは受け取りに失敗する", async function() {
                // 50000受け取れない
                await expect( claimTokens(randomIndex(), "50000") ).to.be.revertedWith("NonCustodialLockup: Insufficient vested amount");
            });

            it("Fail: べスティング後もステーキングのロックにより受け取りに失敗する", async function() {
                // べスティング総量を25000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;
                // 1も受け取れない
                await expect( claimTokens(randomIndex(), "1") ).to.be.revertedWith("NonCustodialLockup: Requested amount exceeds unlockable");
            });

            it("退職処理後もステーキング報酬は受け取れるが、元本回収は誰もできない", async function () {
                let count = await _FNCTLockupManager.getDeployedContractCount();
                let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

                let index = randomIndex();
                let contract = await getDeployedContract(index);

                // 退職によるトークン放棄
                await expect(
                    contract.connect(users[index]).unclaimTokens()
                ).not.to.be.reverted

                // ステーキング報酬は受け取れる
                await expect(
                    contract.connect(users[index]).proxyClaimStakingReward()
                ).not.to.be.reverted;

                // 元本回収はできない(メンバー)
                await expect(
                    contract.connect(users[index]).claimTokens("1")
                ).to.be.revertedWith("NonCustodialLockup: Already unclaimed");

                // 元本回収メソッドを呼び出しても受け取れるトークンがないので失敗
                await expect(
                    contract.connect(reclaim).withdrawUnclaimedTokens()
                ).to.be.revertedWith("Staking: Amount is zero");

                // 180日たっていないため元本回収はできない(会社)
                await expect(Number(web3.utils.fromWei(String(
                    await _FNCToken.balanceOf(reclaim.address)
                )))).to.equal(0);
            });
        });

        describe("Step: Day181", function () {
            beforeEach(async function() {
                // 時刻をDay181に設定
                await _TimeContract.setCurrentTimeIndex(181);
            });

            it("Fail: 未べスティングでは受け取りに失敗する", async function() {
                // 50000受け取れない
                await expect( claimTokens(randomIndex(), "50000") ).to.be.revertedWith("NonCustodialLockup: Insufficient vested amount");
            });

            it("Success: べスティング後は全量受け取れる(50000一括)", async function() {
                // べスティング総量を50000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_50000_tokens) ).not.to.be.reverted;
                // 50000受け取り
                await expect( claimTokens(randomIndex(), "50000") ).not.to.be.reverted;
            });

            it("Success: べスティング後は全量受け取れる(25000ずつ分割)", async function() {
                // べスティング総量を50000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_50000_tokens) ).not.to.be.reverted;
                let index = randomIndex();
                // 25000受け取り
                await expect( claimTokens(index, "25000") ).not.to.be.reverted;
                // 25000受け取り
                await expect( claimTokens(index, "25000") ).not.to.be.reverted;
            });

            it("Success: べスティング後は全量受け取れる(10000ずつ分割)", async function() {
                // べスティング総量を50000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_50000_tokens) ).not.to.be.reverted;
                let index = randomIndex();
                // 10000受け取り
                await expect( claimTokens(index, "10000") ).not.to.be.reverted;
                // 10000受け取り
                await expect( claimTokens(index, "10000") ).not.to.be.reverted;
                // 10000受け取り
                await expect( claimTokens(index, "10000") ).not.to.be.reverted;
                // 10000受け取り
                await expect( claimTokens(index, "10000") ).not.to.be.reverted;
                // 10000受け取り
                await expect( claimTokens(index, "10000") ).not.to.be.reverted;
            });

            it("Success: べスティング後は全量受け取った後に追加べスティング後、更に受けとれる", async function() {
                // べスティング総量を25000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;
                let index = randomIndex();
                // 25000受け取り
                await expect( claimTokens(index, "25000") ).not.to.be.reverted;

                // 時刻をDay360に設定
                await _TimeContract.setCurrentTimeIndex(360);

                // べスティング総量を50000に
                await expect(  _FNCTLockupManager.vestTokens(addresses, num_50000_tokens) ).not.to.be.reverted;

                // 追加された25000を受け取れる
                await expect( claimTokens(index, "25000") ).not.to.be.reverted;
            });

            it("退職処理後もステーキング報酬は受け取れるが、元本回収は会社しかできない", async function () {
                let count = await _FNCTLockupManager.getDeployedContractCount();
                let contracts = await _FNCTLockupManager.getDeployedContractList(0, count);

                let index = randomIndex();
                let contract = await getDeployedContract(index);

                // 退職によるトークン放棄
                await expect(
                    contract.connect(users[index]).unclaimTokens()
                ).not.to.be.reverted

                // ステーキング報酬は受け取れる
                await expect(
                    contract.connect(users[index]).proxyClaimStakingReward()
                ).not.to.be.reverted;

                // 元本回収はできない(メンバー)
                await expect(
                    contract.connect(users[index]).claimTokens("1")
                ).to.be.revertedWith("NonCustodialLockup: Already unclaimed");

                // 元本回収メソッドを呼び出せる
                await expect(
                    contract.connect(reclaim).withdrawUnclaimedTokens()
                ).not.to.be.reverted;

                // 180日たったため元本回収できる(会社)
                await expect(Number(web3.utils.fromWei(String(
                    await _FNCToken.balanceOf(reclaim.address)
                )))).to.equal(50000);
            });

            it("Fail: べスティング総量を超えて受け取れない", async function() {
                // べスティング総量を25000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;
                // 25001受け取りできない(25001 > 25000のため)
                await expect( claimTokens(randomIndex(), "25001") ).to.be.revertedWith("NonCustodialLockup: Insufficient vested amount");
            });

            it("Fail: 一度ベスティングした数量を下回るべスティング量に変更はできない", async function() {
                // べスティング総量を50000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_50000_tokens) ).not.to.be.reverted;

                // すでに50000べスティングされているので25000には減らせない
                await expect(
                    _FNCTLockupManager.vestTokens(addresses, num_25000_tokens)
                ).to.be.revertedWith("NonCustodialLockup: Already vested higher than specified totalAmount");
            });

            it("Fail: 追加べスティング後、べスティング総量を超えて受け取れない", async function() {
                // べスティング総量を25000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;
                let index = randomIndex();

                // 25000受け取り
                await expect( claimTokens(index, "25000") ).not.to.be.reverted;

                // べスティング総量を50000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_50000_tokens) ).not.to.be.reverted;

                // 25001受け取りできない(25000+25001 > 50000のため)
                expect( claimTokens(index, "25001") ).to.be.revertedWith("NonCustodialLockup: Insufficient vested amount");
            });

            it("Fail: 追加べスティングされるまで受け取れない", async function() {
                // べスティング総量を25000に
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;
                let index = randomIndex();
                await expect( claimTokens(index, "25000") ).not.to.be.reverted;

                // べスティング総量を25000のままに
                await expect( _FNCTLockupManager.vestTokens(addresses, num_25000_tokens) ).not.to.be.reverted;

                // 1受け取りできない(25000+1 > 25000のため)
                await expect( claimTokens(index, "1") ).to.be.revertedWith("NonCustodialLockup: Insufficient vested amount");
            });
        });
    });
});
