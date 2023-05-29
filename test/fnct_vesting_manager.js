const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { deployAll, deployFNCToken } = require('./support/deploy');
const { genUsers, sample } = require("./support/utils");
const {indexToDouble} = require('truffle/build/791.bundled');

describe("FCNT Vesting Manager", function () {
    beforeEach(async function() {
        [owner, nobody] = await ethers.getSigners();
        _FNCToken = await deployFNCToken();

        // Target contract
        const FNCTVestingManager = await ethers.getContractFactory('FNCTVestingManager');
        _FNCTVestingManager = await FNCTVestingManager.deploy(
            _FNCToken.address
        );
        await _FNCTVestingManager.deployed();

        addresses = [];
        num_50000_tokens = [];
        num_25000_tokens = [];

        // Initialize users
        let window = 30;
        users = await genUsers(window, owner, ethers.utils.parseEther("10000"));

        for ( let i = 0; i < window; i++ ) {
            addresses.push(users[i].address);
        }

        for ( let i = 0; i < addresses.length; i++ ) {
            num_50000_tokens.push(ethers.utils.parseEther("50000"));
            num_25000_tokens.push(ethers.utils.parseEther("25000"));
        }

        // 一括で発行
        await _FNCTVestingManager.deployVesting(addresses);

        // デプロイ済みコントラクトの個数チェック
        let count = await _FNCTVestingManager.getDeployedContractCount();
        expect(count).to.equal(users.length);

        // トークン発行
        await _FNCToken.mint(_FNCTVestingManager.address, ethers.utils.parseEther("5000000"));

        // アロケート
        await expect(
            _FNCTVestingManager.allocateTokens(addresses, num_50000_tokens)
        ).not.to.reverted;
    });

    function randomIndex() {
        return Math.floor(Math.random() * users.length);
    }

    const getDeployedContract = async (index) => {
        const NonCustodialVesting = await ethers.getContractFactory('NonCustodialVesting');
        let count = await _FNCTVestingManager.getDeployedContractCount();
        let contracts = await _FNCTVestingManager.getDeployedContractList(0, count);
        return NonCustodialVesting.attach(contracts[index].deployedContract);
    }

    const claimTokens = async (index, value) => {
        let contract = await getDeployedContract(index);
        return contract.connect(users[index]).claimTokens(ethers.utils.parseEther(value));
    }

    it("Fail: 未べスティングでは受け取りに失敗する", async function() {
        // 50000受け取れない
        await expect( claimTokens(randomIndex(), "50000") ).to.be.revertedWith("NonCustodialVesting: Insufficient vested amount");
    });

    it("Success: べスティング後は全量受け取れる(50000一括)", async function() {
        // べスティング総量を50000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_50000_tokens) ).not.to.reverted;
        // 50000受け取り
        await expect( claimTokens(randomIndex(), "50000") ).not.to.be.reverted;
    });

    it("Success: べスティング後は全量受け取れる(25000ずつ分割)", async function() {
        // べスティング総量を50000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_50000_tokens) ).not.to.reverted;
        let index = randomIndex();
        // 25000受け取り
        await expect( claimTokens(index, "25000") ).not.to.be.reverted;
        // 25000受け取り
        await expect( claimTokens(index, "25000") ).not.to.be.reverted;
    });

    it("Success: べスティング後は全量受け取れる(10000ずつ分割)", async function() {
        // べスティング総量を50000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_50000_tokens) ).not.to.reverted;
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
        await expect( _FNCTVestingManager.vestTokens(addresses, num_25000_tokens) ).not.to.reverted;
        let index = randomIndex();
        // 25000受け取り
        await expect( claimTokens(index, "25000") ).not.to.be.reverted;

        // べスティング総量を50000に
        await expect(  _FNCTVestingManager.vestTokens(addresses, num_50000_tokens) ).not.to.reverted;

        // 追加された25000を受け取れる
        await expect( claimTokens(index, "25000") ).not.to.be.reverted;
    });

    it("Fail: べスティング総量を超えて受け取れない", async function() {
        // べスティング総量を25000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_25000_tokens) ).not.to.reverted;
        // 25001受け取りできない(25001 > 25000のため)
        await expect( claimTokens(randomIndex(), "25001") ).to.be.revertedWith("NonCustodialVesting: Insufficient vested amount");
    });

    it("Fail: 一度ベスティングした数量を下回るべスティング量に変更はできない", async function() {
        // べスティング総量を50000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_50000_tokens) ).not.to.reverted;

        // すでに50000べスティングされているので25000には減らせない
        await expect(
            _FNCTVestingManager.vestTokens(addresses, num_25000_tokens)
        ).to.revertedWith("NonCustodialVesting: Already vested higher than specified totalAmount");
    });

    it("Fail: 追加べスティング後、べスティング総量を超えて受け取れない", async function() {
        // べスティング総量を25000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_25000_tokens) ).not.to.reverted;
        let index = randomIndex();

        // 25000受け取り
        await expect( claimTokens(index, "25000") ).not.to.be.reverted;

        // べスティング総量を50000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_50000_tokens) ).not.to.reverted;

        // 25001受け取りできない(25000+25001 > 50000のため)
        expect( claimTokens(index, "25001") ).to.be.revertedWith("NonCustodialVesting: Insufficient vested amount");
    });

    it("Fail: 追加べスティングされるまで受け取れない", async function() {
        // べスティング総量を25000に
        await expect( _FNCTVestingManager.vestTokens(addresses, num_25000_tokens) ).not.to.reverted;
        let index = randomIndex();
        await expect( claimTokens(index, "25000") ).not.to.be.reverted;

        // べスティング総量を25000のままに
        await expect( _FNCTVestingManager.vestTokens(addresses, num_25000_tokens) ).not.to.reverted;

        // 1受け取りできない(25000+1 > 25000のため)
        await expect( claimTokens(index, "1") ).to.be.revertedWith("NonCustodialVesting: Insufficient vested amount");
    });
});
