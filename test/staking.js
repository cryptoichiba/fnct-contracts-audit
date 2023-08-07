const {expect} = require('chai');
const {ethers} = require('hardhat');
const {deployFNCToken, deployTimeContract, deployVaultContract, deployValidatorContract, deployStakingContract
} = require('./support/deploy');

describe('StakingContract', () => {
  let _TimeContract;
  let _FNCToken;
  let _VaultContract;
  let _ValidatorContract;
  let _StakingContract;
  let owner, delegator1, delegator2;
  let validator1, validator2;
  const amount = BigInt(5 * 10 ** 18);

  beforeEach(async () => {
    [owner, validator1, validator2, delegator1, delegator2] = await ethers.getSigners();

    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await deployTimeContract(3600, true, owner);
    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _ValidatorContract = await deployValidatorContract(_TimeContract, false, owner);
    _StakingContract = await deployStakingContract(_TimeContract, _FNCToken, _VaultContract, _ValidatorContract, false, owner);

    await _VaultContract.setupStakingRole(_StakingContract.address);

    await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5)

    await _FNCToken.connect(owner).mint(delegator1.address, amount);
    await _FNCToken.connect(owner).mint(delegator2.address, amount);
    await _FNCToken.connect(owner).approve(_VaultContract.address, amount);
    await _FNCToken.connect(delegator1).approve(_VaultContract.address, amount);
    await _FNCToken.connect(delegator2).approve(_VaultContract.address, amount);
  })

  it('Should deploy smart contract properly', async () => {
    console.log('ADDRESS: ', _StakingContract.address);
    expect(_StakingContract.address).not.to.equal('');
  })

  it('Fail: Unrenounceable', async () => {
    await expect(
        _StakingContract.connect(owner).renounceOwnership()
    ).to.be.revertedWith("UnrenounceableOwnable: Can't renounce ownership");
  })

  describe('lockAndDelegate', async () => {
    it('Should lock & delegate 5 tokens', async () => {
      const ownerBalance = await _FNCToken.connect(owner).balanceOf(owner.address);
      const vaultBalance = await _FNCToken.connect(owner).balanceOf(_VaultContract.address);

      await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);

      const ownerBalanceAfter = await _FNCToken.connect(owner).balanceOf(owner.address);
      const vaultBalanceAfter = await _FNCToken.connect(owner).balanceOf(_VaultContract.address);

      const actual = ethers.BigNumber.from(amount);
      expect(ownerBalanceAfter.toString()).to.equal(ownerBalance.sub(actual).toString());
      expect(vaultBalanceAfter.toString()).to.equal(vaultBalance.add(actual).toString());
    })

    context('change validator', async() => {
      beforeEach(async () => {
        await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
        await _TimeContract.setCurrentTimeIndex(1);
      })

      it('Should emit event including new validator, old validator, and  0 amount', async () => {
        await expect(
          _StakingContract.connect(owner).lockAndDelegate(0, validator2.address)
        ).to.emit(
          _StakingContract, "LockedAndDelegated"
        ).withArgs(
          owner.address, validator2.address, validator1.address, '0'
        );
      })
    })
  })

  describe('getValidator', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
    })

    it('Should return validator1 you delegated to', async () => {
      const actual = await _StakingContract.connect(owner).getValidator(owner.address);
      expect(validator1.address).to.equal(actual);
    })
  });

  describe('canChangeValidator', async () => {
    it('should return True', async () => {
      await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
      await _TimeContract.setCurrentTimeIndex(1);

      const canChange = await _StakingContract.connect(owner).canChangeValidator(owner.address);
      expect(canChange).to.equal(true);
    });
  });

  describe('getTotalDelegatedTo', async () => {
    context('already set total delegated to', async () => {
      beforeEach(async () => {
        await _TimeContract.setCurrentTimeIndex(0);
        await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
        await _TimeContract.setCurrentTimeIndex(1);
      })

      it('should return 5 tokens', async () => {
        const totalDelegatedTo = await _StakingContract.connect(owner).getTotalDelegatedTo(0, validator1.address);
        expect(totalDelegatedTo.toString()).to.equal(ethers.BigNumber.from(amount).toString());
      })

    })
  })

  describe('Exploit: Delegator voting power never reduced when unlocked', async () => {
    it('Reverted with panic code 0x11(overflow)', async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
      await _TimeContract.setCurrentTimeIndex(182);
      await _StakingContract.connect(owner).unlock(amount);
      await _FNCToken.connect(owner).approve(_VaultContract.address, amount);
      await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
    })

    it('The amount after re-delegating after stakes are unlocked should be double the initial amount', async () => {
      /*
        1. Bob locks X tokens with validator1 on day 1
        2. Fast forward 180 days in the future, Bob unlocks their X tokens. The amount is reduced from
        validator1's voting power but Bob's _validationPowerByDelegator entry is never reduced, so he
        still has their X tokens power in there.
        3. On the next day (or any time really), Alice decides to stake X tokens with validator1 too (for simplicity).
        4. Bob also decides to stake their X tokens, this time with validator2. Calling lockAndDelegate() will result
        in reducing Bobs previous voting power (X tokens) from validator1 (again). This also means that their previous
        voting power plus X amount (2 times X basically in this case) will be assigned to validator2.
      */
      await _TimeContract.setCurrentTimeIndex(1);
      await _StakingContract.connect(owner).lockAndDelegate(amount, validator1.address);
      let totalDelegatedToValidator1 = await _StakingContract.connect(owner).getTotalDelegatedTo(1, validator1.address);
      expect(totalDelegatedToValidator1).to.equal(amount);
      await _TimeContract.setCurrentTimeIndex(182);
      await _StakingContract.connect(owner).unlock(amount);
      totalDelegatedToValidator1 = await _StakingContract.connect(owner).getTotalDelegatedTo(182, validator1.address);
      expect(totalDelegatedToValidator1).to.equal(0);
      await _TimeContract.setCurrentTimeIndex(183);
      await _StakingContract.connect(delegator1).lockAndDelegate(amount, validator1.address); // Bypass the amount not being updated for now
      await _FNCToken.connect(owner).approve(_VaultContract.address, amount);
      await _StakingContract.connect(owner).lockAndDelegate(amount, validator2.address);
      totalDelegatedToValidator1 = await _StakingContract.connect(owner).getTotalDelegatedTo(183, validator1.address);
      const totalDelegatedToValidator2 = await _StakingContract.connect(owner).getTotalDelegatedTo(183, validator2.address);

      // Before fixing the issue #2/QSP-3, VP1 becomes 0 and VP2 becomes amount * 2
      expect(totalDelegatedToValidator1).to.equal(amount * BigInt(1)); // 0 +amount -amount +amount should be amount * 1
      expect(totalDelegatedToValidator2).to.equal(amount * BigInt(1)); // 0 +amount should be amount * 1
    })
  });
});