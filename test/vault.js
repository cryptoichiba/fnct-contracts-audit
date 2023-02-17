const {expect} = require('chai');
const {ethers} = require('hardhat');

describe('VaultContract', () => {
  let _TimeContract;
  let _FNCToken;
  let _VaultContract;
  let owner, delegator1;

  beforeEach(async () => {
    [owner, delegator1] = await ethers.getSigners();

    // contracts
    const TimeContract = await ethers.getContractFactory('MockTimeContract');
    const FNCToken = await ethers.getContractFactory('FNCToken');
    const VaultContract = await ethers.getContractFactory('VaultContract');
    _TimeContract = await TimeContract.deploy(0, 0); // For mock time
    await _TimeContract.deployed();

    _FNCToken = await FNCToken.deploy();
    await _FNCToken.deployed();

    _VaultContract = await VaultContract.deploy(
      _TimeContract.address,
      _FNCToken.address,
    );
    await _VaultContract.deployed();
    await _VaultContract.setupStakingRole(owner.address);
  })

  it('Should deploy smart contract properly', async () => {
    console.log('ADDRESS: ', _VaultContract.address);
    expect(_VaultContract.address).not.to.equal('');
  })

  it('Fail: Unrenounceable', async () => {
    await expect(
        _VaultContract.connect(owner).renounceOwnership()
    ).to.be.revertedWith("UnrenounceableOwnable: Can't renounce ownership");
  })

  describe('calcLock', async () => {
    const amount = 6 * 10 ** 18;

    beforeEach(async () => {
      await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
      await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
      await _TimeContract.setCurrentTimeIndex(0);
    })

    it('Should return lock amount', async () => {
      const lock = await _VaultContract.calcLock(owner.address);
      expect(lock.toString()).to.equal(amount.toString());
    })
  })

  describe('calcUnLockable', async () => {
    const amount = 6 * 10 ** 18;

    beforeEach(async () => {
      await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
      await _TimeContract.setCurrentTimeIndex(0);
      await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
    })

    context('When the day is more than minimum holding period', async () => {
      it('Should return unlock amount', async () => {
        await _TimeContract.setCurrentTimeIndex(181);

        const unlockable = await _VaultContract.calcUnlockable(owner.address);

        expect(unlockable.toString()).to.equal(amount.toString());
      })
    })

    context('When the day is not more than minimum holding period', async () => {
      it('Should return 0 amount', async () => {
        await _TimeContract.setCurrentTimeIndex(180);

        const unlockable = await _VaultContract.calcUnlockable(owner.address);
        expect(unlockable.toString()).to.equal('0');
      })
    })
  })

  describe('calcLockOfDay', async () => {
    context('calc user locks', async () => {
      const amount = 6 * 10 ** 18;

      context('user locked on specific day', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
        })

        it('include user\'s locks', async () => {
          const day = 2;
          const lock = await _VaultContract.calcLockOfDay(day, owner.address);
          expect(lock.toString()).to.equal(amount.toString());
        })
      })

      context('future locks from specific day exists.', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(3);
          await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
        })

        it('does not include future locks', async () => {
          const day = 2;
          const lock = await _VaultContract.calcLockOfDay(day, owner.address);
          expect(lock.toString()).to.equal('0');
        })
      })

      context('other user\'s locks exists.', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _FNCToken.connect(owner).mint(delegator1.address, web3.utils.toWei('100').toString());
          await _FNCToken.connect(delegator1).approve(_VaultContract.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(delegator1.address, BigInt(amount));
        })

        it('does not include those', async () => {
          const day = 2;
          const lock = await _VaultContract.calcLockOfDay(day, owner.address);
          expect(lock.toString()).to.equal('0');
        })
      })
    });

    context('calc user unlocks', async () => {
      const amount = 6 * 10 ** 18;

      context('user unlocked on specific day', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(owner.address, BigInt(amount));
        })

        it('include user\'s unlocks', async () => {
          const day = 181;
          const lock = await _VaultContract.calcLockOfDay(day, owner.address);
          expect(lock.toString()).to.equal('0');
        })

        it('Updated lockable amount', async () => {
          const unlockable = await _VaultContract.calcUnlockable(owner.address);
          expect(unlockable.toString()).to.equal('0');
        })

        it('Fail unlock', async () => {
          await expect(
            _VaultContract.connect(owner).unlock(owner.address, BigInt(amount))
          ).to.be.revertedWith('Vault: Requested amount exceeds unlockable');
        })
      })

      context('future unlocks from specific day exists.', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
          await _TimeContract.setCurrentTimeIndex(182);
          await _VaultContract.connect(owner).unlock(owner.address, BigInt(amount));
        })

        it('does not include future unlocks', async () => {
          const day = 180;
          const lock = await _VaultContract.calcLockOfDay(day, owner.address);
          expect(lock.toString()).to.equal(amount.toString());
        })
      })

      context('other user\'s unlocks exists.', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _FNCToken.connect(owner).mint(delegator1.address, web3.utils.toWei('100').toString());
          await _FNCToken.connect(delegator1).approve(_VaultContract.address, BigInt(amount));
          await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(delegator1.address, BigInt(amount));
          await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(delegator1.address, BigInt(amount));
        })

        it('does not include those', async () => {
          const day = 181;
          const lock = await _VaultContract.calcLockOfDay(day, owner.address);
          expect(lock.toString()).to.equal(amount.toString());
        })
      })
    });
  });

  describe('unlock', async () => {
    const amount = ethers.BigNumber.from(BigInt(5 * 10 ** 18));

    context('unlockable amount exists', async () => {
      beforeEach(async () => {
        await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
        await _TimeContract.setCurrentTimeIndex(0);
        await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
        await _TimeContract.setCurrentTimeIndex(181);
      })

      it('Should unlock amount', async () => {
        const ownerBalance = await _FNCToken.connect(owner).balanceOf(owner.address);
        const vaultBalance = await _FNCToken.connect(owner).balanceOf(_VaultContract.address);

        await _VaultContract.connect(owner).unlock(owner.address, amount);

        const ownerBalanceAfter = await _FNCToken.connect(owner).balanceOf(owner.address);
        const vaultBalanceAfter = await _FNCToken.connect(owner).balanceOf(_VaultContract.address);

        expect(ownerBalanceAfter.toString()).to.equal(ownerBalance.add(amount).toString());
        expect(vaultBalanceAfter.toString()).to.equal(vaultBalance.sub(amount).toString());
      })
    })

    context('unlockable amount does not exist', async () => {
      beforeEach(async () => {
        await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(amount));
        await _TimeContract.setCurrentTimeIndex(0);
        await _VaultContract.connect(owner).addLock(owner.address, BigInt(amount));
        await _TimeContract.setCurrentTimeIndex(179);
      })

      it('Should not unlock amount', async () => {
        await expect(
          _VaultContract.connect(owner).unlock(owner.address, amount)
        ).to.be.revertedWith('Vault: Requested amount exceeds unlockable');
      })
    })
  })
});
