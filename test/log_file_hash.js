const {expect} = require('chai');
const {ethers} = require('hardhat');
const {deployLogFileHash, deployRNG, deployStakingContract, deployTimeContract, deployFNCToken, deployVaultContract,
  deployValidatorContract
} = require('./support/deploy');

describe('LogFileHash', () => {
  let _TimeContract;
  let _FNCToken;
  let _VaultContract;
  let _ValidatorContract;
  let _StakingContract;
  let _LogFileHash;
  let owner, delegator1, delegator2;
  let validator1, validator2, validator3;
  let nobody, submitter;
  const amount = BigInt(5 * 10 ** 18);

  beforeEach(async () => {
    [owner, validator1, validator2, validator3, delegator1, delegator2, nobody, submitter] = await ethers.getSigners();

    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await deployTimeContract(3600, true, owner);
    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _ValidatorContract = await deployValidatorContract(_TimeContract, false, owner);
    _StakingContract = await deployStakingContract(_TimeContract, _FNCToken, _VaultContract, _ValidatorContract, false, owner);
    _RNG = await deployRNG(_TimeContract, true, owner);
    _LogFileHash = await deployLogFileHash(_TimeContract, _StakingContract, _ValidatorContract, _RNG, false, owner);

    await _VaultContract.setupStakingRole(_StakingContract.address);

    await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5)

    await _FNCToken.connect(owner).mint(delegator1.address, amount);
    await _FNCToken.connect(owner).mint(delegator2.address, amount);
    await _FNCToken.connect(owner).approve(_VaultContract.address, amount);
    await _FNCToken.connect(delegator1).approve(_VaultContract.address, amount);
    await _FNCToken.connect(delegator2).approve(_VaultContract.address, amount);
  })

  it('Pre validated hash', async () => {
    const factory = await ethers.getContractFactory("LogFileHash", owner);
    const LogFileHashPreValidated = await factory.deploy(
        _TimeContract.address,
        _StakingContract.address,
        _ValidatorContract.address,
        _RNG.address,
        [web3.utils.bytesToHex(0x00000001), web3.utils.bytesToHex(0x00000002), web3.utils.bytesToHex(0x00000003)]
    );
    await LogFileHashPreValidated.deployed();

    const result = await LogFileHashPreValidated.getLatestValidFile();
    expect(result[0]).to.equal(2);
    expect(result[1]).to.equal(web3.utils.bytesToHex(0x00000003));
  })

  it('Success: Submit', async () => {
    // New submitter can submit
    await expect(
        _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02')
    ).to.emit(
        _LogFileHash, "HashSubmitted"
    ).withArgs(0, 0, validator1.address, validator1.address, '0x01', '0-01');
  })

  it('Success: Change submitter / validator', async () => {
    await expect(
        _ValidatorContract.connect(validator1).setSubmitter(submitter.address)
    ).not.to.be.reverted;

    // Validator1 master wallet no longer available
    await expect(
        _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02')
    ).to.be.revertedWith("LogFileHash: Sender is allowed as a submitter");

    // New submitter can submit
    await expect(
        _LogFileHash.connect(submitter).submit(validator1.address, 0, '0x01', '0x02')
    ).to.emit(
        _LogFileHash, "HashSubmitted"
    ).withArgs(0, 0, validator1.address, submitter.address, '0x01', '0-01');
  })

  it('Fail: Change submitter / non-validator', async () => {
    await expect(
        _ValidatorContract.connect(nobody).setSubmitter(submitter.address)
    ).to.be.revertedWith("Validator: Caller is not validator or disabled");
  })

  describe('getMajority', async () => {
    context('no submit on the day', async () => {
      it('should return no validators', async () => {
        const result = await _LogFileHash.connect(owner).getMajority(0);
        expect(result[0]).to.equal('0x');
        expect(result[1].length).to.equal(0);
        expect(result[2].length).to.equal(0);
        expect(result[3]).to.equal('0');
      })
    });

    context('validator submitted on the day', async () => {
      context('validators submit same hashes', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(amount, validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(amount, validator2.address);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x01', '0x02');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
        })

        it('should return validators', async () => {
          const result = await _LogFileHash.connect(owner).getMajority(0);
          expect(result[0]).to.equal('0x01');
          expect(result[1].length).to.equal(2);
          expect(result[2].length).to.equal(2);
          expect(result[3]).to.equal(amount * BigInt(2));
        })
      })

      context('validators submit different hashes', async () => {
        context('validators have different delegated amount', async () => {
          beforeEach(async () => {
            await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(10**18), validator1.address);
            await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 2 * 10**18), validator2.address);
            await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
            await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
            await _TimeContract.setCurrentTimeIndex(1);
            await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          })

          it('should return majority validators', async () => {
            const result = await _LogFileHash.connect(owner).getMajority(0);
            expect(result[0]).to.equal('0x02');
            expect(result[1]).to.eql([validator2.address]);
            expect(result[2]).to.eql([validator1.address, validator2.address]);
            expect(result[3]).to.equal(BigInt(2 * 10**18).toString());
          })
        })

        context('validators have same delegated amount', async () => {
          beforeEach(async () => {
            await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(10**18), validator1.address);
            await _StakingContract.connect(delegator2).lockAndDelegate(BigInt(10**18), validator2.address);
            await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
            await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
            await _TimeContract.setCurrentTimeIndex(1);
            await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          })

          it('should return no validators', async () => {
            const result = await _LogFileHash.connect(owner).getMajority(0);
            expect(result[0]).to.equal('0x');
            expect(result[1]).to.eql([]);
            expect(result[2]).to.eql([validator1.address, validator2.address]);
            expect(result[3]).to.equal('0');
          })
        })

        context('validators have no delegators', async () => {
          beforeEach(async () => {
            await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
            await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
            await _TimeContract.setCurrentTimeIndex(1);
            await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          })

          it('should return 0 power', async () => {
            const result = await _LogFileHash.connect(owner).getMajority(0);
            expect(result[0]).to.equal('0x');
            expect(result[1]).to.eql([]);
            expect(result[2]).to.eql([validator1.address, validator2.address]);
            expect(result[3]).to.equal('0');
          })
        })
      })

      context('a validator submit different hashes (0x01 to 0x02) on the day', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10**18), validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 10**18), validator2.address);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x02', '0x03');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
        })

        it('should return majority validators of 0x02', async () => {
          const result = await _LogFileHash.connect(owner).getMajority(0);
          expect(result[0]).to.equal('0x02');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18).toString());
        })
      })

      context('a validator submit same hashes on the day', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10**18), validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 10**18), validator2.address);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
        })

        it('should return majority validator of 0x01', async () => {
          const result = await _LogFileHash.connect(owner).getMajority(0);
          expect(result[0]).to.equal('0x01');
          expect(result[1]).to.eql([validator1.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(2 * 10**18).toString());
        })
      })

      context('Validator submit to change filehash', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10**18), validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 10**18), validator2.address);
        })

        it('First day, first validator changed', async () => {
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x02', '0x03');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
          await _LogFileHash.connect(validator3).submit(validator3.address, 0, '0x02aa', '0x03aa');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');

          let result = await _LogFileHash.getMajority(0);
          expect(result[0]).to.equal('0x02');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address, validator3.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));
        })

        it('First day, second validator changed', async () => {
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator3).submit(validator3.address, 0, '0x02aa', '0x03aa');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');

          let result = await _LogFileHash.getMajority(0);
          expect(result[0]).to.equal('0x01');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address, validator3.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));
        })

        it('Second day, first validator changed', async () => {
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator3).submit(validator3.address, 0, '0x02aa', '0x03aa');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x03');
          await _LogFileHash.connect(validator1).submit(validator1.address, 1, '0x02', '0x03');
          await _LogFileHash.connect(validator2).submit(validator2.address, 1, '0x02', '0x03');
          await _LogFileHash.connect(validator3).submit(validator3.address, 1, '0x02aa', '0x03aa');
          await _TimeContract.setCurrentTimeIndex(2);
          await _LogFileHash.connect(validator1).submit(validator1.address, 1, '0x02', '0x03');

          let result = await _LogFileHash.getMajority(1);
          expect(result[0]).to.equal('0x02');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address, validator3.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));
        })

        it('Second day, second validator changed', async () => {
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator3).submit(validator3.address, 0, '0x02aa', '0x03aa');
          await _TimeContract.setCurrentTimeIndex(1);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 1, '0x03', '0x04');
          await _LogFileHash.connect(validator2).submit(validator2.address, 1, '0x02', '0x03');
          await _LogFileHash.connect(validator3).submit(validator3.address, 1, '0x02aa', '0x03aa');
          await _TimeContract.setCurrentTimeIndex(2);
          await _LogFileHash.connect(validator1).submit(validator1.address, 1, '0x02', '0x03');

          let result = await _LogFileHash.getMajority(1);
          expect(result[0]).to.equal('0x02');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address, validator3.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));
        })
      })

      context('Validators caught up latest file', async () => {
        beforeEach(async () => {
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10**18), validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 10**18), validator2.address);
        })

        it('Send null hash, And send to overwrite a new hash', async () => {
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x01', '0x02');
          await _TimeContract.setCurrentTimeIndex(1);

          result = await _LogFileHash.getMajority(0);
          expect(result[0]).to.equal('0x01');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));

          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 1, '0x02', '0x03');
          await _TimeContract.setCurrentTimeIndex(2);

          result = await _LogFileHash.getMajority(1);
          expect(result[0]).to.equal('0x02');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));

          await _LogFileHash.connect(validator1).submit(validator1.address, 1, '0x02', '0x03');
          await _LogFileHash.connect(validator2).submit(validator2.address, 2, '0x03', []);
          await _TimeContract.setCurrentTimeIndex(3);

          result = await _LogFileHash.getMajority(2);
          expect(result[0]).to.equal('0x03');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));

          await _LogFileHash.connect(validator1).submit(validator1.address, 2, '0x03', []);
          await _LogFileHash.connect(validator2).submit(validator2.address, 3, [], []);
          await _TimeContract.setCurrentTimeIndex(4);

          result = await _LogFileHash.getMajority(3);
          expect(result[0]).to.equal('0x');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));

          await _LogFileHash.connect(validator1).submit(validator1.address, 3, [], []);
          await _LogFileHash.connect(validator2).submit(validator2.address, 3, [], []);
          await _TimeContract.setCurrentTimeIndex(5);

          result = await _LogFileHash.getMajority(4);
          expect(result[0]).to.equal('0x');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));

          await _LogFileHash.connect(validator1).submit(validator1.address, 3, '0x04', []);
          await _LogFileHash.connect(validator2).submit(validator2.address, 3, '0x04', []);

          await _TimeContract.setCurrentTimeIndex(6);

          result = await _LogFileHash.getMajority(5);
          expect(result[0]).to.equal('0x04');
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18));
        })
      })

      context('user changed delegated validator', async () => {
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10**18), validator1.address);
          await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 10**18), validator2.address);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');

          await _TimeContract.setCurrentTimeIndex(1);
          await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(0), validator2.address);
          await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
          await _LogFileHash.connect(validator2).submit(validator2.address, 1, '0x02', '0x03');
          await _TimeContract.setCurrentTimeIndex(2);
          await _LogFileHash.connect(validator1).submit(validator1.address, 1, '0x01', '0x02');
        })

        it('should return majority validator of 0x01 at day 0', async () => {
          const result = await _LogFileHash.connect(owner).getMajority(0);
          expect(result[0]).to.equal('0x01');
          // Majority: Validators which sent hash=0x01
          expect(result[1]).to.eql([validator1.address]);
          // Majority: Validators which sent any hash
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(2 * 10**18).toString());
        })

        it('should return majority validator of 0x02 at day 1', async () => {
          const result = await _LogFileHash.connect(owner).getMajority(1);
          expect(result[0]).to.equal('0x02');
          // Majority: Validators which sent hash=0x02
          expect(result[1]).to.eql([validator1.address, validator2.address]);
          // Majority: Validators which sent any hash
          expect(result[2]).to.eql([validator1.address, validator2.address]);
          expect(result[3]).to.equal(BigInt(3 * 10**18).toString());
        })
      })
    })

    context('LINK suspended 30 days for a day', async () => {
      let WinnerStatus = {
        Decided: 0,
        NoWinnerForFutureDate: 1,
        NoMajority: 2,
        NoSubmissionToday: 3,
        Pending: 4,
        Abandoned: 5
      };

      beforeEach(async () => {
        await _TimeContract.setCurrentTimeIndex(0);
        await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(2 * 10**18), validator1.address);
        await _StakingContract.connect(delegator2).lockAndDelegate(BigInt( 10**18), validator2.address);
        await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
        await _LogFileHash.connect(validator2).submit(validator2.address, 0, '0x02', '0x03');

        await _TimeContract.setCurrentTimeIndex(1);
        await _StakingContract.connect(delegator1).lockAndDelegate(BigInt(0), validator2.address);
        await _LogFileHash.connect(validator1).submit(validator1.address, 0, '0x01', '0x02');
        await _LogFileHash.connect(validator2).submit(validator2.address, 1, '0x02', '0x03');

        await _TimeContract.setCurrentTimeIndex(2);
        await _LogFileHash.connect(validator1).submit(validator1.address, 1, '0x01', '0x02');
      })

      it('Day 2: still pending for day 2', async () => {
        const result = await _LogFileHash.getWinner(1);
        expect(result[1]).to.equal(WinnerStatus.Pending);
      })

      it('Day 32: still pending for day 2', async () => {
        await _TimeContract.setCurrentTimeIndex(31);
        result = await _LogFileHash.getWinner(1);
        expect(result[1]).to.equal(WinnerStatus.Pending);
      })

      it('Day 33: abandoned for day 2', async () => {
        await _TimeContract.setCurrentTimeIndex(32);
        result = await _LogFileHash.getWinner(1);
        expect(result[1]).to.equal(WinnerStatus.Abandoned);
      })
    })
  })
});
