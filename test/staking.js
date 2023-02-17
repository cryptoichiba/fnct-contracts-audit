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

  describe('getDelegators', async () => {
    context('delegated users don\'t exist', async () => {
      it('should return 0 delegator', async () => {
        const delegators = await _StakingContract.connect(owner).getDelegators(0, validator1.address);
        expect(delegators.length).to.equal(0);
      })
    });

    context('delegated users exist', async () => {
      context('validator is 0 address', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(1);
          await _StakingContract.connect(delegator1).lockAndDelegate(amount, validator1.address);
        });

        it('should return 0 delegator', async () => {
          const delegators = await _StakingContract.connect(owner).getDelegators(0, ethers.constants.AddressZero);
          expect(delegators.length).to.equal(0);
        })
      });

      context('user delegated after the day', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(1);
          await _StakingContract.connect(delegator1).lockAndDelegate(amount, validator1.address);
        });

        it('should return 0 delegator', async () => {
          const delegators = await _StakingContract.connect(owner).getDelegators(0, validator1.address);
          expect(delegators.length).to.equal(0);
        })
      })

      context('user delegated another validator', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(amount, validator2.address);
        });

        it('should return 0 delegator', async () => {
          const delegators = await _StakingContract.connect(owner).getDelegators(0, validator1.address);
          expect(delegators.length).to.equal(0);
        })
      })

      context('user delegated on the day', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(amount, validator1.address);
        });

        it('should return delegator1', async () => {
          const delegators = await _StakingContract.connect(owner).getDelegators(0, validator1.address);
          expect(delegators[0]).to.equal(delegator1.address);
        })
      })

      context('user delegated another validator but delegated again', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10 ** 18), validator2.address);
          await _TimeContract.setCurrentTimeIndex(1);
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10 ** 18), validator1.address);
        });

        it('should return delegator1', async () => {
          const delegators = await _StakingContract.connect(owner).getDelegators(1, validator1.address);
          expect(delegators[0]).to.equal(delegator1.address);
        })
      })

      context('multiple users delegated', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(amount), validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(BigInt(amount), validator1.address);
        });

        it('should return delegator1, delegator2', async () => {
          const delegators = await _StakingContract.connect(owner).getDelegators(0, validator1.address);
          expect(delegators[0]).to.equal(delegator1.address);
          expect(delegators[1]).to.equal(delegator2.address);
          expect(delegators.length).to.equal(2);
        })
      })
    })
  })

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
});
