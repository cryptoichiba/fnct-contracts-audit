const {expect} = require('chai');
const {ethers} = require('hardhat');
const { deployLogFileHash, deployTimeContract, deployStakingContract, deployFNCToken, deployVaultContract,
  deployValidatorContract, deployRewardContract, deployRNG
} = require('./support/deploy');

describe('RewardContract', (_) => {
  let _FNCToken = null;
  let _TimeContract = null;
  let _RewardContract = null;
  let _StakingContract = null;
  let _VaultContract = null;
  let _ValidatorContract = null;
  let _LogFileHash = null;
  let _RNG = null, _ChainlinkWrapper = null, _ChainlinkCoordinator = null;
  let owner, validator1, validator2, validator3, delegator1, delegator2, delegator3;
  let WinnerStatus = {
    Decided: 0,
    NoWinnerForFutureDate: 1,
    NoMajority: 2,
    NoSubmissionToday: 3,
    Pending: 4,
    Abandoned: 5
  };

  before(async () => {
    [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3] = await ethers.getSigners();
    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await deployTimeContract(3600, true, owner);
    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _ValidatorContract = await deployValidatorContract(_TimeContract, false, owner);
    _StakingContract = await deployStakingContract(_TimeContract, _FNCToken, _VaultContract, _ValidatorContract, false, owner);
    [_RNG, _ChainlinkWrapper, _ChainlinkCoordinator] = await deployRNG(_TimeContract, true, owner);
    _LogFileHash = await deployLogFileHash(_TimeContract, _StakingContract, _ValidatorContract, _RNG, true, owner);
    _RewardContract = await deployRewardContract(_TimeContract, _FNCToken, _StakingContract, _ValidatorContract, _VaultContract, _LogFileHash, false, owner);

    // setup pool
    const allocateSize = web3.utils.toWei('10000').toString();
    await _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize);
    await _RewardContract.connect(owner).supplyStakingPool(1, allocateSize);

    // setup validator
    await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5)
  })

  it('Should deploy smart contract properly', async () => {
    console.log('ADDRESS: ', _RewardContract.address);
    expect(_RewardContract.address).not.to.equal('');
  })

  it('Fail: Unrenounceable', async () => {
    await expect(
        _RewardContract.connect(owner).renounceOwnership()
    ).to.be.revertedWith("UnrenounceableOwnable: Can't renounce ownership");
  })

  describe('getStakingRewardAccrualHistory', async () => {
    before(async () => {
      // setup locks
      const vp1 = web3.utils.toWei('100').toString();
      const vp2 = web3.utils.toWei('200').toString();
      const vp3 = web3.utils.toWei('300').toString();
      await _FNCToken.connect(owner).mint(delegator1.address, vp1);
      await _FNCToken.connect(owner).mint(delegator2.address, vp2);
      await _FNCToken.connect(owner).mint(delegator3.address, vp3);
      await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1);
      await _FNCToken.connect(delegator2).approve(_VaultContract.address, vp2);
      await _FNCToken.connect(delegator3).approve(_VaultContract.address, vp3);
      await _VaultContract.setupStakingRole(_StakingContract.address);
      await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address);
      await _StakingContract.connect(delegator2).lockAndDelegate(vp2, validator1.address);
      await _StakingContract.connect(delegator3).lockAndDelegate(vp3, validator1.address);
      await _TimeContract.setCurrentTimeIndex(6);
    });

    beforeEach(async () => {
      // reset
      await _LogFileHash.setWinner(1, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(2, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, ethers.constants.AddressZero, WinnerStatus.NoMajority);
    });

    it('basic operation', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(4, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(5, validator1.address, WinnerStatus.Decided);

      const nRecords = 3;
      const result = await _RewardContract.getStakingRewardAccrualHistory(delegator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      result.forEach((e) => {
        expect(e.amount).to.be.within(web3.utils.toWei('2.50'), web3.utils.toWei('2.6'));
      });
    });

    it('If accrualDate was lost along the way, go back to where the day exists', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, validator1.address, WinnerStatus.Decided);

      const nRecords = 3;
      const result = await _RewardContract.getStakingRewardAccrualHistory(delegator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      result.forEach((e) => {
        // base: 17FNCT
        // reward: base * (1 - 0.1) * 100 / 600 = 25.5
        expect(e.amount).to.be.within(web3.utils.toWei('2.50'), web3.utils.toWei('2.6'));
      });
      expect(result[0].date).to.equal(5);
      expect(result[1].date).to.equal(2);
      expect(result[2].date).to.equal(1);
    })

    it('If no acuralDate corresponds to startDate, start with the nearest past accuralDate.', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, ethers.constants.AddressZero, WinnerStatus.NoMajority);

      const nRecords = 3;
      const result = await _RewardContract.getStakingRewardAccrualHistory(delegator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      result.forEach((e) => {
        expect(e.amount).to.be.within(web3.utils.toWei('2.50'), web3.utils.toWei('2.6'));
      });
      expect(result[0].date).to.equal(3);
      expect(result[1].date).to.equal(2);
      expect(result[2].date).to.equal(1);
    });

    it('If the number of records to be taken is less than nRecords, take as many as you can.', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);

      const nRecords = 3;
      const result = await _RewardContract.getStakingRewardAccrualHistory(delegator1.address, 5, nRecords);

      expect(result.length).to.equal(2);
      result.forEach((e) => {
        expect(e.amount).to.be.within(web3.utils.toWei('2.50'), web3.utils.toWei('2.6'));
      });
      expect(result[0].date).to.equal(2);
      expect(result[1].date).to.equal(1);
    });
  });

  describe('getStakingCommissionAccrualHistory', async () => {
    before(async () => {
      // setup locks
      const vp1 = web3.utils.toWei('100').toString();
      const vp2 = web3.utils.toWei('200').toString();
      const vp3 = web3.utils.toWei('300').toString();
      await _FNCToken.connect(owner).mint(delegator1.address, vp1);
      await _FNCToken.connect(owner).mint(delegator2.address, vp2);
      await _FNCToken.connect(owner).mint(delegator3.address, vp3);
      await _FNCToken.connect(delegator1).approve(_VaultContract.address, vp1);
      await _FNCToken.connect(delegator2).approve(_VaultContract.address, vp2);
      await _FNCToken.connect(delegator3).approve(_VaultContract.address, vp3);
      await _VaultContract.setupStakingRole(_StakingContract.address);
      await _StakingContract.connect(delegator1).lockAndDelegate(vp1, validator1.address);
      await _StakingContract.connect(delegator2).lockAndDelegate(vp2, validator1.address);
      await _StakingContract.connect(delegator3).lockAndDelegate(vp3, validator1.address);
      await _TimeContract.setCurrentTimeIndex(6);
    });

    beforeEach(async () => {
      // reset
      await _LogFileHash.setWinner(1, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(2, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, ethers.constants.AddressZero, WinnerStatus.NoMajority);
    });

    it('basic operation', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(4, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(5, validator1.address, WinnerStatus.Decided);

      const nRecords = 3;
      const result = await _RewardContract.getStakingCommissionAccrualHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      result.forEach((e) => {
        expect(e.amount).to.be.within(web3.utils.toWei('1.6'), web3.utils.toWei('1.71'));
      });
    });

    it('If accrualDate was lost along the way, go back to where the day exists', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, validator1.address, WinnerStatus.Decided);

      const nRecords = 3;
      const result = await _RewardContract.getStakingCommissionAccrualHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      result.forEach((e) => {
        // base: 17FNCT
        // reward: base * (1 - 0.1) * 10%(commission rate) = 1.7
        expect(e.amount).to.be.within(web3.utils.toWei('1.6'), web3.utils.toWei('1.71'));
      });
      expect(result[0].date).to.equal(5);
      expect(result[1].date).to.equal(2);
      expect(result[2].date).to.equal(1);
    })

    it('If no acuralDate corresponds to startDate, start with the nearest past accuralDate', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, ethers.constants.AddressZero, WinnerStatus.NoMajority);

      const nRecords = 3;
      const result = await _RewardContract.getStakingCommissionAccrualHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      result.forEach((e) => {
        expect(e.amount).to.be.within(web3.utils.toWei('1.6'), web3.utils.toWei('1.71'));
      });
      expect(result[0].date).to.equal(3);
      expect(result[1].date).to.equal(2);
      expect(result[2].date).to.equal(1);
    });

    it('If the number of records to be taken is less than nRecords, take as many as you can', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);

      const nRecords = 3;
      const result = await _RewardContract.getStakingCommissionAccrualHistory(validator1.address, 5, nRecords);

      expect(result.length).to.equal(2);
      result.forEach((e) => {
        expect(e.amount).to.be.within(web3.utils.toWei('1.6'), web3.utils.toWei('1.71'));
      });
      expect(result[0].date).to.equal(2);
      expect(result[1].date).to.equal(1);
    });

  });

  describe('getValidationHistory', async () => {
    before(async () => {
      await _TimeContract.setCurrentTimeIndex(0);
    });

    beforeEach(async () => {
      // reset
      await _LogFileHash.setParticipatedValidators(1, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setParticipatedValidators(2, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setParticipatedValidators(3, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setParticipatedValidators(4, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setParticipatedValidators(5, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setMajorityValidators(1, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setMajorityValidators(2, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setMajorityValidators(3, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setMajorityValidators(4, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setMajorityValidators(5, [validator1.address, validator2.address, validator3.address]);
      await _LogFileHash.setWinner(1, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(2, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, ethers.constants.AddressZero, WinnerStatus.NoMajority);
    });

    it('returns histories in descending date order.', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(4, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(5, validator1.address, WinnerStatus.Decided);

      const nRecords = 5;
      const result = await _RewardContract.getValidationHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      expect(result[0].validationDate).to.equal(5);
      expect(result[1].validationDate).to.equal(4);
      expect(result[2].validationDate).to.equal(3);
      expect(result[3].validationDate).to.equal(2);
      expect(result[4].validationDate).to.equal(1);
    });

    it('Recycle staking pool', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, ethers.constants.AddressZero, WinnerStatus.Abandoned);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.Pending);
      await _LogFileHash.setWinner(5, ethers.constants.AddressZero, WinnerStatus.NoSubmissionToday);
      await _LogFileHash.setWinner(6, ethers.constants.AddressZero, WinnerStatus.NoWinnerForFutureDate);
      await _TimeContract.setCurrentTimeIndex(7);

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 1)
      ).to.be.revertedWith("Reward: Winner status should be NoMajority or Abandoned");

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 4)
      ).to.be.revertedWith("Reward: Winner status should be NoMajority or Abandoned");

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 5)
      ).to.be.revertedWith("Reward: Winner status should be NoMajority or Abandoned");

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 6)
      ).to.be.revertedWith("Reward: Winner status should be NoMajority or Abandoned");

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 2)
      ).to.emit(
          _RewardContract, "StakingTokenSupplyRecycled"
      ).withArgs(
          7, 2, ethers.BigNumber.from("17050827360000000000"), ethers.BigNumber.from("9915007421698310086338")
      );

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 2)
      ).to.be.revertedWith("Reward: Already recycled");

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(7, 3)
      ).to.be.revertedWith("Reward: Already scheduled after specified day");

      await expect(
          _RewardContract.connect(owner).recycleStakingPool(10, 3)
      ).to.emit(
          _RewardContract, "StakingTokenSupplyRecycled"
      ).withArgs(
          10, 3, ethers.BigNumber.from("17021704546869120000"), ethers.BigNumber.from("9881311352895652512875")
      );
    });

    it('There were days when Validator didn\'t participate in.', async () => {
      await _LogFileHash.setParticipatedValidators(1, [validator1.address]);
      await _LogFileHash.setParticipatedValidators(2, [validator1.address]);
      await _LogFileHash.setParticipatedValidators(3, [validator1.address]);
      await _LogFileHash.setParticipatedValidators(4, []);
      await _LogFileHash.setParticipatedValidators(5, []);

      const nRecords = 5;
      const result = await _RewardContract.getValidationHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      expect(result[0].isJoined).to.equal(false);
      expect(result[1].isJoined).to.equal(false);
      expect(result[2].isJoined).to.equal(true);
      expect(result[3].isJoined).to.equal(true);
      expect(result[4].isJoined).to.equal(true);
    });

    it('There were days when Validator didn\'t be majority.', async () => {
      await _LogFileHash.setMajorityValidators(1, [validator1.address]);
      await _LogFileHash.setMajorityValidators(2, [validator1.address]);
      await _LogFileHash.setMajorityValidators(3, [validator1.address]);
      await _LogFileHash.setMajorityValidators(4, []);
      await _LogFileHash.setMajorityValidators(5, []);

      const nRecords = 5;
      const result = await _RewardContract.getValidationHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      expect(result[0].isValid).to.equal(false);
      expect(result[1].isValid).to.equal(false);
      expect(result[2].isValid).to.equal(true);
      expect(result[3].isValid).to.equal(true);
      expect(result[4].isValid).to.equal(true);
    });

    it('There were days when Validator didn\'t win.', async () => {
      await _LogFileHash.setWinner(1, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(2, validator1.address, WinnerStatus.Decided);
      await _LogFileHash.setWinner(3, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(4, ethers.constants.AddressZero, WinnerStatus.NoMajority);
      await _LogFileHash.setWinner(5, validator1.address, WinnerStatus.Decided);

      const nRecords = 5;
      const result = await _RewardContract.getValidationHistory(validator1.address, 5, nRecords);
      expect(result.length).to.equal(nRecords);
      expect(result[0].isElected).to.equal(true);
      expect(result[1].isElected).to.equal(false);
      expect(result[2].isElected).to.equal(false);
      expect(result[3].isElected).to.equal(true);
      expect(result[4].isElected).to.equal(true);

      expect(result[0].rewardAmount).not.to.equal('0');
      expect(result[1].rewardAmount).to.equal('0');
      expect(result[2].rewardAmount).to.equal('0');
      expect(result[3].rewardAmount).not.to.equal('0');
      expect(result[4].rewardAmount).not.to.equal('0');
    })

    it('If the number of records to be taken is less than nRecords, take as many as you can.', async () => {
      const nRecords = 5;
      const result = await _RewardContract.getValidationHistory(validator1.address, 2, nRecords);

      expect(result.length).to.equal(3);
    });
  });
});
