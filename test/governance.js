const {expect} = require('chai');
const {ethers} = require('hardhat');
const {deployFNCToken, deployVaultContract, deployGovernanceContract} = require('./support/deploy');

describe('GovernanceContract', () => {
  const ipfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
  const optionNumber = 4;
  const maxOptionNumber = 5;
  const multipleVote = true;

  const startVotingDay = 1;
  const endVotingDay = 10;
  const minVotingPeriod = 2;
  const maxVotingPeriod = 200;

  const minimumStakingAmount = 1 * 10 ** 18;
  const minValueOfMinimumStakeAmount = 1 * 9 ** 18;
  const maxValueOfMinimumStakeAmount = 2 * 10 ** 18;
  const day = 1;
  const dayOfTally = 1;

  const voteOptions = [1, 3, 4];
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  const ownerAmount = 5 * 10 ** 18;
  const voterAmount = 1 * 10 ** 18;
  const ipfsHashNumber = 0;

  const voteOptions1 = [1, 3, 4];
  const voteOptions2 = [1, 2, 4];
  const voteOptions3 = [2, 4];

  beforeEach(async () => {
    [owner, voter1, voter2, voter3, issueProposer, tallyExecuter] = await ethers.getSigners();

    const TimeContract = await ethers.getContractFactory('MockTimeContract');
    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await TimeContract.deploy(0, 0);
    await _TimeContract.deployed();

    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _GovernanceContract = await deployGovernanceContract(
      _TimeContract,
      _FNCToken,
      _VaultContract,
      BigInt(minValueOfMinimumStakeAmount),
      BigInt(maxValueOfMinimumStakeAmount),
      minVotingPeriod,
      maxVotingPeriod,
      maxOptionNumber,
      false,
      owner
    );

    await _VaultContract.setupStakingRole(owner.address);

    await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(ownerAmount));
    await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
    await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
    await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));

    await _FNCToken.connect(owner).transfer(voter1.address, BigInt(voterAmount));
    await _FNCToken.connect(owner).transfer(voter2.address, BigInt(voterAmount));
    await _FNCToken.connect(owner).transfer(voter3.address, BigInt(voterAmount));
    await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
    await _VaultContract.connect(owner).addLock(voter2.address, BigInt(voterAmount));
    await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voterAmount));

    // Sets the minimumStakeAmount rate allowance range from `min` to `max`.
    await _GovernanceContract.connect(owner).setMinimumStakeAmountRange(
      BigInt(minValueOfMinimumStakeAmount),
      BigInt(maxValueOfMinimumStakeAmount)
    );

    // Sets the voting period(endVotingDay - startVotingDay) range allowance range from `min` to `max`.
    await _GovernanceContract.connect(owner).setVotingPeriodRange(minVotingPeriod, maxVotingPeriod);

    // Sets the maximum allowed option number value.
    await _GovernanceContract.connect(owner).setMaxOptionNumber(maxOptionNumber);
    await _GovernanceContract.connect(owner).grantIssueProposerRole(issueProposer.address);
    await _GovernanceContract.connect(owner).grantTallyVotingRole(tallyExecuter.address);
  });

  it('Should deploy smart contract properly', async () => {
    expect(_GovernanceContract.address).not.to.equal('');
  });

  describe('setMinimumStakeAmountRange', async () => {
    const minValueOfMinimumStakeAmount = 1 * 10 ** 18;
    const maxValueOfMinimumStakeAmount = 2 * 10 ** 18;

    context('When params is valid', async() => {
      it('Should emit event including minValueOfMinimumStakeAmount, maxValueOfMinimumStakeAmount', async () => {
        await expect(
          _GovernanceContract.connect(owner).setMinimumStakeAmountRange(
            BigInt(minValueOfMinimumStakeAmount),
            BigInt(maxValueOfMinimumStakeAmount)
          )
        ).to.emit(
          _GovernanceContract, 'MinimumStakeAmountRangeUpdated'
        ).withArgs(
          BigInt(minValueOfMinimumStakeAmount),
          BigInt(maxValueOfMinimumStakeAmount)
        );
      });
    });

    context('When max is less than min.', async() => {
      const invalidMinValueOfMinimumStakeAmount = 2 * 10 ** 18;
      const invalidMaxValueOfMinimumStakeAmount = 1 * 10 ** 18;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).setMinimumStakeAmountRange(
            BigInt(invalidMinValueOfMinimumStakeAmount),
            BigInt(invalidMaxValueOfMinimumStakeAmount)
          )
        ).to.be.revertedWith("Governance: max should be equal or less than min.");
      });
    });

    context('When min is less than 0.', async() => {
      const invalidMinValueOfMinimumStakeAmount = 0;
      const maxValueOfMinimumStakeAmount = 2 * 10 ** 18;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).setMinimumStakeAmountRange(
            BigInt(invalidMinValueOfMinimumStakeAmount),
            BigInt(maxValueOfMinimumStakeAmount)
          )
        ).to.be.revertedWith("Governance: min should be greater than 0.");
      });
    });
  });

  describe('getMinimumStakeAmountRange', async () => {
    const minValueOfMinimumStakeAmount = 10 * 10 ** 18;
    const maxValueOfMinimumStakeAmount = 20 * 10 ** 18;

    beforeEach(async () => {
      await _GovernanceContract.connect(owner).setMinimumStakeAmountRange(
        BigInt(minValueOfMinimumStakeAmount),
        BigInt(maxValueOfMinimumStakeAmount)
      );
    });

    context('When get minimum stake amount range', async() => {
      it('min and max voting period value', async () => {
        const actual = await _GovernanceContract.connect(voter1).getMinimumStakeAmountRange();

        expect(BigInt(minValueOfMinimumStakeAmount)).to.equal(actual[0]);
        expect(BigInt(maxValueOfMinimumStakeAmount)).to.equal(actual[1]);
      });
    });
  });

  describe('grantIssueProposerRole', async () => {
    context('When params is valid', async() => {
      it('Should emit event including ownerAddress, authorizedAddress', async () => {
        await expect(
          _GovernanceContract.connect(owner).grantIssueProposerRole(
            issueProposer.address
          )
        ).to.emit(
          _GovernanceContract, 'IssueProposerRoleGranted'
        ).withArgs(
          owner.address,
          issueProposer.address
        );
      });
    });

    context('When authorizedAddress is invalid', async() => {
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).grantIssueProposerRole(
            zeroAddress
          )
        ).to.be.revertedWith("Governance: Address is zero address");
      });
    });
  });

  describe('setVotingPeriodRange', async () => {
    context('When params is valid', async() => {
      it('Should emit event including minVotingPeriod, maxVotingPeriod', async () => {
        await expect(
          _GovernanceContract.connect(owner).setVotingPeriodRange(
            minVotingPeriod,
            maxVotingPeriod
          )
        ).to.emit(
          _GovernanceContract, 'VotingPeriodRangeUpdated'
        ).withArgs(
          minVotingPeriod,
          maxVotingPeriod
        );
      });
    });

    context('When max is less than min.', async() => {
      const invalidMinVotingPeriod = 200;
      const invalidMaxVotingPeriod = 2;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).setVotingPeriodRange(
            invalidMinVotingPeriod,
            invalidMaxVotingPeriod
          )
        ).to.be.revertedWith("Governance: max should be equal or less than min.");
      });
    });

    context('When authorizedAddress is invalid', async() => {
      const invalidMinVotingPeriod = 0;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).setVotingPeriodRange(
            invalidMinVotingPeriod,
            maxVotingPeriod
          )
        ).to.be.revertedWith("Governance: min should be greater than 0.");
      });
    });
  });

  describe('getVotingPeriodRange', async () => {
    const minVotingPeriod = 2;
    const maxVotingPeriod = 200;

    beforeEach(async () => {
      await _GovernanceContract.connect(owner).setVotingPeriodRange(
        minVotingPeriod,
        maxVotingPeriod
      );
    });

    context('When get voting period range', async() => {
      it('Should return min and max voting period value', async () => {
        const actual = await _GovernanceContract.connect(voter1).getVotingPeriodRange();

        expect(minVotingPeriod).to.equal(actual[0]);
        expect(maxVotingPeriod).to.equal(actual[1]);
      });
    });
  });

  describe('grantTallyVotingRole', async () => {
    context('When params is valid', async() => {
      it('Should emit event including ownerAddress, authorizedAddress', async () => {
        await expect(
          _GovernanceContract.connect(owner).grantTallyVotingRole(
            tallyExecuter.address
          )
        ).to.emit(
          _GovernanceContract, 'TallyVotingRoleGranted'
        ).withArgs(
          owner.address,
          tallyExecuter.address
        );
      });
    });

    context('When params is invalid', async() => {
      const invalidMinVotingPeriod = 100;
      const invalidMaxVotingPeriod = 1;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).setVotingPeriodRange(
            invalidMinVotingPeriod,
            invalidMaxVotingPeriod,
          )
        ).to.be.revertedWith("Governance: max should be equal or less than min.");
      });
    });

    context('When authorizedAddress is invalid', async() => {
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).grantTallyVotingRole(
            zeroAddress
          )
        ).to.be.revertedWith("Governance: Address is zero address");
      });
    });
  });

  describe('setMaxOptionNumber', async () => {
    context('When params is valid', async() => {
      it('Should emit event including maxOptionNumber', async () => {
        await expect(
          _GovernanceContract.connect(owner).setMaxOptionNumber(
            maxOptionNumber
          )
        ).to.emit(
          _GovernanceContract, 'MaxOptionNumberUpdated'
        ).withArgs(
          maxOptionNumber
        );
      });
    });

    context('When max is less than min.', async() => {
      const invalidMaxOptionNumber = 0;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).setMaxOptionNumber(
            invalidMaxOptionNumber
          )
        ).to.be.revertedWith("Governance: maxNumber should be greater than 0.");
      });
    });
  });

  describe('getMaxOptionNumber', async () => {
    const maxOptionNumber = 5;

    beforeEach(async () => {
      await _GovernanceContract.connect(owner).setMaxOptionNumber(
        maxOptionNumber
      );
    });

    context('When get Max Option number', async() => {
      it('Should return max option number', async () => {
        const actual = await _GovernanceContract.connect(voter1).getMaxOptionNumber();

        expect(maxOptionNumber).to.equal(actual);
      });
    });
  });

  describe('revokeIssueProposerRole', async () => {
    context('When params is valid', async() => {
      it('Should emit event including ownerAddress, revokedAddress', async () => {
        await expect(
          _GovernanceContract.connect(owner).revokeIssueProposerRole(
            issueProposer.address
          )
        ).to.emit(
          _GovernanceContract, 'IssueProposerRoleRevoked'
        ).withArgs(
          owner.address,
          issueProposer.address
        );
      });
    });

    context('When revokedAddress is invalid', async() => {
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).revokeIssueProposerRole(
            zeroAddress
          )
        ).to.be.revertedWith("Governance: Address is zero address");
      });
    });
  });

  describe('revokeTallyVotingRol', async () => {
    context('When params is valid', async() => {
      it('Should emit event including ownerAddress, revokedAddress', async () => {
        await expect(
          _GovernanceContract.connect(owner).revokeTallyVotingRole(
            tallyExecuter.address
          )
        ).to.emit(
          _GovernanceContract, 'TallyVotingRoleRevoked'
        ).withArgs(
          owner.address,
          tallyExecuter.address
        );
      });
    });

    context('When revokedAddress is invalid', async() => {
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).revokeTallyVotingRole(
            zeroAddress
          )
        ).to.be.revertedWith("Governance: Address is zero address");
      });
    });
  });

  describe('propose', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(owner).grantIssueProposerRole(issueProposer.address);
    });

    context('When params is valid', async() => {
      it('Should emit event including ipfsHash, optionNumber, multipleVote, startVotingDay, endVotingDay', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.emit(
          _GovernanceContract, 'Propose'
        ).withArgs(
          ipfsHash,
          optionNumber,
          BigInt(minimumStakingAmount),
          multipleVote,
          startVotingDay,
          endVotingDay
        );
      });
    });

    context('When ipfsHash is empty', async() => {
      const ipfsHash = '0x0000000000000000000000000000000000000000000000000000000000000000';

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith("Governance: ipfsHash is empty.");
      });
    });

    context('When optionalNumber is 0', async() => {
      const invalidOptionNumber = 0;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            invalidOptionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith("Governance: OptionNumber is invalid.");
      });
    });

    context('When startVotingDay is more than endVotingDay', async() => {
      const startVotingDay = 10;
      const invalidEndVotingDay = 1;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            invalidEndVotingDay
          )
        ).to.be.revertedWith("Governance: startVotingDay or endVotingDay is wrong");
      });
    });

    context('When startVoting is invalid', async() => {
      const invalidStartVotingDay = 0;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            invalidStartVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith("Governance: startVotingDay is wrong");
      });
    });

    context('When ipfsHash is invalid', async() => {
      beforeEach(async () => {
        await _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          );
      });

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith("Governance: specified ipfsHash is already registered");
      });
    });

    context('When execute method by unprivileged user', async() => {
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith(`AccessControl: account 0x70997970c51812dc3a010c7d01b50e0d17dc79c8 is missing role 0x8c0b481d3b4e913a4153d609c74102ff37f3729681b837d6c90495f5420fed52`);
      });
    });

    context('When minimumStakingAmount is less than min.', async() => {
      const invalidMinimumStakingAmount = 1 * 8 ** 18;
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(invalidMinimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith('Governance: minimumStakingAmount should be equal or greater than min.');
      });
    });

    context('When minimumStakingAmount is greater than max.', async() => {
      const invalidMinimumStakingAmount = 1 * 11 ** 18;
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(invalidMinimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith('Governance: minimumStakingAmount should be equal or less than max.');
      });
    });

    context('When votine period is less than min.', async() => {
      const invalidStartVotingDay = 1;
      const invalidEndVotingDay = 2;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            invalidStartVotingDay,
            invalidEndVotingDay
          )
        ).to.be.revertedWith('Governance: Voting period should be equal or greater than min.');
      });
    });

    context('When option number is greater than max.', async() => {
      const invalidStartVotingDay = 1;
      const invalidEndVotingDay = 202;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            invalidStartVotingDay,
            invalidEndVotingDay
          )
        ).to.be.revertedWith('Governance: Voting period should be equal or less than max.');
      });
    });

    context('When option number is greater than maxOptionNumber.', async() => {
      const invalidOptionNumber = 10;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            invalidOptionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          )
        ).to.be.revertedWith('Governance: Option number should be equal or less than max.');
      });
    });
  });

  describe('getProposal', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay
      );
    });

    context('When ipfsHash is valid', async() => {
      it('Should return proposal', async () => {
        const actual = await _GovernanceContract.connect(voter1).getProposal(ipfsHash);

        expect(ipfsHash).to.equal(actual.ipfsHash);
        expect(optionNumber).to.equal(actual.optionNumber);
        expect(BigInt(minimumStakingAmount)).to.equal(actual.minimumStakingAmount);
        expect(startVotingDay).to.equal(actual.startVotingDay);
        expect(endVotingDay).to.equal(actual.endVotingDay);
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).getProposal(invalidIpfsHash)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('getProposalNumber', async () => {
    const proposalNumber = 0;
    const secondProposalNumber = 1;
    const secondIpfsHash = '0xf8220bacb0bf5bd8ca33a890184b66b35fb64647274b4b9fb4ff90e68f77a5a7';

    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay
      );

      await _GovernanceContract.connect(issueProposer).propose(
        secondIpfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay
      );
    });

    context('When ipfsHash is valid', async() => {
      it('Should return proposal', async () => {
        const actual = await _GovernanceContract.connect(voter1).getProposalNumber(ipfsHash);

        expect(proposalNumber).to.equal(actual);
      });

      it('Should return second proposal', async () => {
        const actual = await _GovernanceContract.connect(voter1).getProposalNumber(secondIpfsHash);

        expect(secondProposalNumber).to.equal(actual);
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).getProposalNumber(invalidIpfsHash)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('getProposalStatus', async () => {
    const endVotingDay = 200;

    context('When ipfsHash is valid', async() => {
      context('When day is 0(before)', async() => {
        const day = 0;

        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          );
        });

        it('Should return proposal status', async () => {
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);

          expect(0).to.equal(actual);
        });
      });

      context('When day is 1(ongoing)', async() => {
        const day = 1;

        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          );
        });

        it('Should return proposal status', async () => {
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);

          expect(1).to.equal(actual);
        });
      });

      context('When day is 1(finished)', async() => {
        const day = 201;

        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(0);
          await _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          );
        });

        it('Should return proposal status', async () => {
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);

          expect(2).to.equal(actual);
        });
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).getProposalStatus(invalidIpfsHash, day)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('getProposalList', async () => {
    const ipfsHash1 = '0x916e14036f2d86a479ab16a3f2cffaf73a5419d12576497cc2d837fb423571a5';
    const ipfsHash2 = '0xf93c20b30171d10e773dc2a2d8ed59524b25baddf381b83fcc4ec40f50bedb33';
    const ipfsHash3 = '0x47697e8ff239f6cb73b7afafb8c82cc85a4f57c67bc7c3a55516cdd998a6f8c6';
    const ipfsHash4 = '0xf8220bacb0bf5bd8ca33a890184b66b35fb64647274b4b9fb4ff90e68f77a5a7';
    const startVotingDay1 = 1;
    const startVotingDay2 = 2;
    const startVotingDay3 = 3;
    const startVotingDay4 = 4;

    const from = 1;
    const quantity = 2;

    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash1,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay1,
        endVotingDay
      );

      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash2,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay2,
        endVotingDay
      );

      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash3,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay3,
        endVotingDay
      );

      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash4,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay4,
        endVotingDay
      );
    });

    context('When params is valid', async() => {
      const from = 1;
      const quantity = 2;

      it('Should return proposal list', async () => {
        const actual = await _GovernanceContract.connect(owner).getProposalList(from, quantity);

        expect(ipfsHash2).to.equal(actual[0].ipfsHash);
        expect(optionNumber).to.equal(actual[0].optionNumber);
        expect(multipleVote).to.equal(actual[0].multipleVote);
        expect(startVotingDay2).to.equal(actual[0].startVotingDay);
        expect(endVotingDay).to.equal(actual[0].endVotingDay);

        expect(ipfsHash3).to.equal(actual[1].ipfsHash);
        expect(optionNumber).to.equal(actual[1].optionNumber);
        expect(multipleVote).to.equal(actual[1].multipleVote);
        expect(startVotingDay3).to.equal(actual[1].startVotingDay);
        expect(endVotingDay).to.equal(actual[1].endVotingDay);
      });
    });

    context('When the sum of the from and quantity values is greater than the _proposalLength value', async() => {
      const from = 1;
      const quantity = 10;

      it('Should return proposal list', async () => {
        const actual = await _GovernanceContract.connect(owner).getProposalList(from, quantity);

        expect(ipfsHash2).to.equal(actual[0].ipfsHash);
        expect(optionNumber).to.equal(actual[0].optionNumber);
        expect(multipleVote).to.equal(actual[0].multipleVote);
        expect(startVotingDay2).to.equal(actual[0].startVotingDay);
        expect(endVotingDay).to.equal(actual[0].endVotingDay);

        expect(ipfsHash3).to.equal(actual[1].ipfsHash);
        expect(optionNumber).to.equal(actual[1].optionNumber);
        expect(multipleVote).to.equal(actual[1].multipleVote);
        expect(startVotingDay3).to.equal(actual[1].startVotingDay);
        expect(endVotingDay).to.equal(actual[1].endVotingDay);

        expect(ipfsHash4).to.equal(actual[2].ipfsHash);
        expect(optionNumber).to.equal(actual[2].optionNumber);
        expect(multipleVote).to.equal(actual[2].multipleVote);
        expect(startVotingDay4).to.equal(actual[2].startVotingDay);
        expect(endVotingDay).to.equal(actual[2].endVotingDay);
      });
    });

    context('When from is invalid', async() => {
      const invalidFrom = 100;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).getProposalList(invalidFrom, quantity)
        ).to.be.revertedWith("Governance: 'from' is greater than number of proposals");
      });
    });

    context('When from params has the same value as _proposalLength ', async() => {
      const invalidFrom = 4;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).getProposalList(invalidFrom, quantity)
        ).to.be.revertedWith("Governance: 'from' is greater than number of proposals");
      });
    });
  });

  describe('getVotingPowerOfDay', async () => {
    const day = 1;
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(day);
    });

    context('When params is valid', async() => {
      it('Should return staking amount', async () => {
        const actual = await _GovernanceContract.connect(voter1).getVotingPowerOfDay(day, voter1.address);
        expect(BigInt(voterAmount)).to.equal(actual);

      });
    });
  });

  describe('vote', async () => {
    const day = 1;

    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(day);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay
      );
    });

    context('When params is valid', async() => {
      it('Should emit event including msg.sender, ipfsHash, voteAmounts', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.emit(
          _GovernanceContract, 'VotedOnProposal'
        ).withArgs(
          ipfsHash, voter1.address, day, BigInt(voterAmount), voteOptions
        );
      });
    });

    context('When second vote', async() => {
      const secondVoteOptions = [1, 4];

      beforeEach(async () => {
        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions);
      })

      it('Should emit event including msg.sender, ipfsHash, voteAmounts', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, secondVoteOptions)
        ).to.emit(
          _GovernanceContract, 'VotedOnProposal'
        ).withArgs(
          ipfsHash, voter1.address, day, BigInt(voterAmount), secondVoteOptions
        );
      });
    });

    context('When ipfsHash is invalid', async() => {
      const invalidIpfsHashNumber = 1;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(invalidIpfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal issue number is wrong");
      });
    });

    context('When multiVoting is false and voting amount is invalid', async() => {
      const ipfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      const multipleVote = false;
      const ipfsHashNumber = 1;

      beforeEach(async () => {
        await _GovernanceContract.connect(issueProposer).propose(
          ipfsHash,
          optionNumber,
          BigInt(minimumStakingAmount),
          multipleVote,
          startVotingDay,
          endVotingDay
        );
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Only single or blank votes.");
      });
    });

    context('When proposal voting is not start', async() => {
      const ipfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      const startVotingDay = 2;
      const ipfsHashNumber = 1;

      beforeEach(async () => {
        await _TimeContract.setCurrentTimeIndex(1);

        await _GovernanceContract.connect(issueProposer).propose(
          ipfsHash,
          optionNumber,
          BigInt(minimumStakingAmount),
          multipleVote,
          startVotingDay,
          endVotingDay
        );
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal voting is not start");
      });
    });

    context('Governance: Proposal voting is finished', async() => {
      beforeEach(async () => {
        await _TimeContract.setCurrentTimeIndex(11);
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal voting is finished");
      });
    });

    context('Voting Options is invalid ', async() => {
      const voteOptions1 = [0, 1, 3];
      const voteOptions2 = [1, 1, 3];
      const voteOptions3 = [3, 2, 1];
      const voteOptions4 = [1, 2, 3, 4, 5];
      const voteOptions5 = [1, 8];

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1)
        ).to.be.revertedWith("Governance: voting Options is invalid");
      });

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2)
        ).to.be.revertedWith("Governance: Voting options must be ascending and unique");
      });

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions3)
        ).to.be.revertedWith("Governance: Voting options must be ascending and unique");
      });

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions4)
        ).to.be.revertedWith("Governance: voting Options is invalid");
      });

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions5)
        ).to.be.revertedWith("Governance: voting Options is invalid");
      });
    });

    context('Governance: TimeContract is launch day', async() => {
      beforeEach(async () => {
        await _TimeContract.setCurrentTimeIndex(0);
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: You cannot vote on Time Contract launch day");
      });
    });
  });

  describe('tallyNumberOfVotesOnProposal', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote, startVotingDay,
        endVotingDay
      );

      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions);
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions);
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions);

      await _TimeContract.setCurrentTimeIndex(2);
    });

    const amountVotesToTally = 2;
    const finalizedProposalCurrentBatchIndex = 2;

    context('When params is valid', async() => {
      it('Should emit event including ipfsHash, day', async () => {
        await expect(
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          )
        ).to.emit(
          _GovernanceContract, 'ResetAmountsForTally'
        ).withArgs(
          ipfsHash,
          day
        );
      });

      it('Should emit event including ipfsHash, amountVotesToTally', async () => {
        await expect(
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          )
        ).to.emit(
          _GovernanceContract, 'Tally'
        ).withArgs(
          ipfsHash,
          day,
          amountVotesToTally,
          finalizedProposalCurrentBatchIndex
        );
      });

      it('Should emit event including ipfsHash, amountVotesToTally', async () => {
        const amountVotesToTally = 2;
        const finalizedProposalCurrentBatchIndex = 3;

        await _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
          ipfsHash,
          amountVotesToTally,
          dayOfTally
        );

        await expect(
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          )
        ).to.emit(
          _GovernanceContract, 'TallyComplete'
        ).withArgs(
          ipfsHash,
          day,
          amountVotesToTally,
          finalizedProposalCurrentBatchIndex
        );
      });
    });

    context('When params is invalid', async() => {
      context('When ipfsHash is invalid', async() => {
        const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
        it('Should return voting history', async () => {
          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              invalidIpfsHash,
              amountVotesToTally,
              dayOfTally
            )
          ).to.be.revertedWith("Governance: ipfs hash is wrong");
        });
      });

      context('When voting has not started yet', async() => {
        const startVotingDay = 3;
        const ipfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde7'

        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(1);
          await _GovernanceContract.connect(issueProposer).propose(
            ipfsHash,
            optionNumber,
            BigInt(minimumStakingAmount),
            multipleVote,
            startVotingDay,
            endVotingDay
          );

          await _TimeContract.setCurrentTimeIndex(2);
        });

        it('Fail: Governance', async () => {
          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              amountVotesToTally,
              dayOfTally
            )
          ).to.be.revertedWith("Governance: Proposal voting is not start");
        });
      });

      context('When The amount votes to tally is 0 or less', async() => {
        const invalidAmountVotesToTally = 0;
        it('Fail: Governance', async () => {
          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              invalidAmountVotesToTally,
              dayOfTally
            )
          ).to.be.revertedWith("Governance: The amount votes to tally must be a number greater than 0");
        });
      });

      context('When tallyNumberOfVotesOnProposal is executed on the current day', async() => {
        const dayOfTally = 2;
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(2);
        });

        it('Fail: Governance', async () => {
          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              amountVotesToTally,
              dayOfTally
            )
          ).to.be.revertedWith("Governance: Can only tally past dates.");
        });
      });
    });
  });

  describe('getTallyStatus', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote, startVotingDay,
        endVotingDay
      );

      await _TimeContract.setCurrentTimeIndex(2);
    });

    context('When params is valid', async() => {
      beforeEach(async () => {
        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions);
        await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions);
        await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions);

        await _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
          ipfsHash,
          amountVotesToTally,
          dayOfTally
        );
        await _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
          ipfsHash,
          amountVotesToTally,
          dayOfTally
        );
      });

      const amountVotesToTally = 2;
      const finalizedProposalCurrentBatchIndex = 2;
      const toralFinalizedIndex = 3;

      it('Should return tally status', async () => {
        const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);

        expect(day).to.equal(actual.day);
        expect(true).to.equal(actual.completed);
        expect(toralFinalizedIndex).to.equal(3);
      });
    });

    context('When all votes were blank votes', async() => {
      beforeEach(async () => {
        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, blankVoteOptions);
        await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, blankVoteOptions);
        await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, blankVoteOptions);

        await _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
          ipfsHash,
          amountVotesToTally,
          dayOfTally
        );
      });

      const amountVotesToTally = 3;
      const toralFinalizedIndex = 3;
      const blankVoteOptions = [];

      it('Should return tally status', async () => {
        const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);

        expect(BigInt("1000000")).to.equal(actual.blankVotingRate);
        expect(day).to.equal(actual.day);
        expect(true).to.equal(actual.completed);
        expect(toralFinalizedIndex).to.equal(3);
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';

      it('Should return voting history', async () => {
        await expect(
          _GovernanceContract.connect(voter1).getTallyStatus(invalidIpfsHash, day)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('getLatestVoteOfUserOnProposal', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(day);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay
      );
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions);
    });

    context('When params is valid', async() => {
      it('Should return voting history', async () => {
        const actual = await _GovernanceContract.connect(voter1).getLatestVoteOfUserOnProposal(ipfsHash, voter1.address);

        expect(day).to.equal(actual.day);
        expect(voter1.address).to.equal(actual.voterAddress);
        expect(voteOptions[0]).to.equal(actual.voteOptions[0]);
        expect(voteOptions[1]).to.equal(actual.voteOptions[1]);
        expect(voteOptions[2]).to.equal(actual.voteOptions[2]);
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';

      it('Should return voting history', async () => {
        await expect(
          _GovernanceContract.connect(voter1).getLatestVoteOfUserOnProposal(
            invalidIpfsHash,
            voter1.address
          )
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('Use case testing', async () => {
    // for Propose 1
    const endVotingDay = 190;

    // for Propose 2
    const ipfsHashNumberOf2 = 1;
    const secondIpfsHash = '0xf8220bacb0bf5bd8ca33a890184b66b35fb64647274b4b9fb4ff90e68f77a5a7';
    const secondOptionNumber = 4;
    const secondMultipleVote = true;
    const secondStartVotingDay = 1;
    const secondEndVotingDay = 188;
    const secondMinimumStakingAmount = 0.8 * 10 ** 18;
    const secondDay = 1;
    const voteOptions1Of2 = [1, 2, 4];
    const voteOptions2Of2 = [2, 4];
    const voteOptions3Of2 = [1, 3, 4];

    // for Propose 3
    const ipfsHashNumberOf3 = 2;
    const thirdIpfsHash = '0x3445b50a09c46b3dee912cd1b8dc9eaa4e756a82b417d97615b92d5cce04d1dd';
    const thirdOptionNumber = 4;
    const thirdMultipleVote = false;
    const thirdStartVotingDay = 1;
    const thirdEndVotingDay = 185;
    const thirdMinimumStakingAmount = 0.5 * 10 ** 18;
    const thirdDay = 1;
    const voteOptions1Of3 = [1];
    const voteOptions2Of3 = [2];
    const voteOptions3Of3 = [4];

    beforeEach(async () => {
      // Propose 1
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay
      );

      // Propose 2
      await _GovernanceContract.connect(issueProposer).propose(
        secondIpfsHash,
        secondOptionNumber,
        BigInt(secondMinimumStakingAmount),
        secondMultipleVote,
        secondStartVotingDay,
        secondEndVotingDay
      );

      // Propose 3
      await _GovernanceContract.connect(issueProposer).propose(
        thirdIpfsHash,
        thirdOptionNumber,
        BigInt(thirdMinimumStakingAmount),
        thirdMultipleVote,
        thirdStartVotingDay,
        thirdEndVotingDay
      );

      await _TimeContract.setCurrentTimeIndex(1);

      // day 1 of Propose 1
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1);
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions3);

      // day 1 of Propose 2
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumberOf2, voteOptions1Of2);
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumberOf2, voteOptions2Of2);
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf2, voteOptions3Of2);

      // day 1 of Propose 3
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumberOf3, voteOptions1Of3);
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumberOf3, voteOptions2Of3);
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf3, voteOptions3Of3);
    });

    context('when voting period is 10 days and talling is performed multiple times during that period', async() => {
      const voter3DailyStakingAmount = 0.2 * 10 ** 18;
      const blankVoting = [];

      context('when talling the 182st day', async() => {
        beforeEach(async () => {
          // day 181 (180 days required to unlock staking)
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

          // day 182
          await _TimeContract.setCurrentTimeIndex(182);
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

          // day 183
          await _TimeContract.setCurrentTimeIndex(183);
        });

        const day = 182;
        const dayOfTally = 182;
        const amountVotesToTally = 3;
        const index = 3;

        it('should return proposal status for 182 days of Propose 1', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("500000000000000000")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 182 days of Propose 2', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            secondIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            secondIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 182 days of Propose 3', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            thirdIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            thirdIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 184st day', async() => {
        beforeEach(async () => {
          // day 181 (180 days required to unlock staking)
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

          // day 182
          await _TimeContract.setCurrentTimeIndex(182);
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

          // day 183
          await _TimeContract.setCurrentTimeIndex(183);
          await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2);
          await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf3, voteOptions2Of3);

          // day 184
          await _TimeContract.setCurrentTimeIndex(184);
          await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter2.address, BigInt(voterAmount));
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);

          // day 185
          await _TimeContract.setCurrentTimeIndex(185);
        });

        const day = 184;
        const dayOfTally = 184;
        const amountVotesToTally = 3;
        const index = 3;

        it('should return proposal status for 184 days of Propose 1', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);
          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("1166666666666666666")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("1166666666666666666")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 184 days of Propose 2', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            secondIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            secondIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("1166666666666666666")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 184 days of Propose 3', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            thirdIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            thirdIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("2000000000000000000")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 185st day', async() => {
        beforeEach(async () => {
          // day 181 (180 days required to unlock staking)
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

          // day 182
          await _TimeContract.setCurrentTimeIndex(182);
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

          // day 183
          await _TimeContract.setCurrentTimeIndex(183);
          await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2);
          await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf3, voteOptions2Of3);

          // day 184
          await _TimeContract.setCurrentTimeIndex(184);
          await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter2.address, BigInt(voterAmount));
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);

          // day 185
          await _TimeContract.setCurrentTimeIndex(185);
          await _VaultContract.connect(owner).unlock(voter3.address, BigInt(voterAmount));

          // day 186
          await _TimeContract.setCurrentTimeIndex(186);
        });

        context('when executing tallyNumberOfVotesOnProposal from 0 to 1', async() => {
          const day = 185;
          const dayOfTally = 185;
          const amountVotesToTally = 2;
          const index = 2;

          it('should return proposal status for 185 days from 0 to 1', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              amountVotesToTally,
              dayOfTally
            );
            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);

            expect(false).to.equal(actual.completed);
            expect(day).to.equal(actual.day);
            expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[0]);
            expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[1]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
            expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingAmount);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });

          it('should return proposal status for 185 days of Propose 2', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              secondIpfsHash,
              amountVotesToTally,
              dayOfTally
            );
            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
              secondIpfsHash,
              day
            );

            expect(false).to.equal(actual.completed);
            expect(day).to.equal(actual.day);
            expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[0]);
            expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
            expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingAmount);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });

          it('should return proposal status for 185 days of Propose 3', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              thirdIpfsHash,
              amountVotesToTally,
              dayOfTally
            );
            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
              thirdIpfsHash,
              day
            );

            expect(false).to.equal(actual.completed);
            expect(day).to.equal(actual.day);
            expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
            expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[1]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingAmount);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });
        });

        context('when executing tallyNumberOfVotesOnProposal from 1 to 2', async() => {
          const day = 185;
          const dayOfTally = 185;
          const firstAmountVotesToTally = 2;
          const firstFinalizedProposalCurrentBatchIndex = 2;
          const secondAmountVotesToTally = 1;
          const secondFinalizedProposalCurrentBatchIndex = 3;
          const index = 3;

          it('should return proposal status for 185 days from 1 to 2 of Propose 1', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              firstAmountVotesToTally,
              dayOfTally
            );

            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              secondAmountVotesToTally,
              dayOfTally
            );
            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);
            expect(true).to.equal(actual.completed);
            expect(day).to.equal(actual.day);
            expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[0]);
            expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[1]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
            expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingAmount);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });

          it('should return proposal status for 185 days from 1 to 2 of Propose 2', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              secondIpfsHash,
              firstAmountVotesToTally,
              dayOfTally
            );

            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              secondIpfsHash,
              secondAmountVotesToTally,
              dayOfTally
            );

            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
              secondIpfsHash,
              day
            );

            expect(true).to.equal(actual.completed);
            expect(day).to.equal(actual.day);
            expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[0]);
            expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
            expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingAmount);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });

          it('should return proposal status for 185 days from 1 to 2 of Propose 3', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              thirdIpfsHash,
              firstAmountVotesToTally,
              dayOfTally
            );

            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              thirdIpfsHash,
              secondAmountVotesToTally,
              dayOfTally
            );

            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
              thirdIpfsHash,
              day
            );

            expect(true).to.equal(actual.completed);
            expect(day).to.equal(actual.day);
            expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
            expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[1]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
            expect(BigInt("0")).to.equal(actual.votingAmounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingAmount);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });

          it('Should emit event including ipfsHash, day', async () => {
            await expect(
              _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
                ipfsHash,
                firstAmountVotesToTally,
                dayOfTally
              )
            ).to.emit(
              _GovernanceContract, 'ResetAmountsForTally'
            ).withArgs(
              ipfsHash,
              day
            );
          });

          it('Should emit event including ipfsHash, amountVotesToTally', async () => {
            await expect(
              _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
                ipfsHash,
                firstAmountVotesToTally,
                dayOfTally
              )
            ).to.emit(
              _GovernanceContract, 'Tally'
            ).withArgs(
              ipfsHash,
              day,
              firstAmountVotesToTally,
              firstFinalizedProposalCurrentBatchIndex
            );
          });

          it('Should emit event including ipfsHash, amountVotesToTally', async () => {
            await _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              firstAmountVotesToTally,
              dayOfTally
            );

            await expect(
              _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
                ipfsHash,
                secondAmountVotesToTally,
                dayOfTally
              )
            ).to.emit(
              _GovernanceContract, 'TallyComplete'
            ).withArgs(
              ipfsHash,
              day,
              secondAmountVotesToTally,
              secondFinalizedProposalCurrentBatchIndex
            );
          });
        });
      });

      context('when talling the 188st day', async() => {
        beforeEach(async () => {
          // day 181 (180 days required to unlock staking)
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

          // day 182
          await _TimeContract.setCurrentTimeIndex(182);
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

          // day 183
          await _TimeContract.setCurrentTimeIndex(183);
          await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2);
          await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf3, voteOptions2Of3);

          // day 184
          await _TimeContract.setCurrentTimeIndex(184);
          await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter2.address, BigInt(voterAmount));
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);

          // day 185
          await _TimeContract.setCurrentTimeIndex(185);
          await _VaultContract.connect(owner).unlock(voter3.address, BigInt(voterAmount));

          // day 186
          await _TimeContract.setCurrentTimeIndex(186);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 187
          await _TimeContract.setCurrentTimeIndex(187);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 188
          await _TimeContract.setCurrentTimeIndex(188);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 189
          await _TimeContract.setCurrentTimeIndex(189);
        });

        const day = 188;
        const dayOfTally = 188;
        const amountVotesToTally = 3;
        const index = 3;

        it('should return proposal status for 188 days of Propose 1', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);
          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("666666666666666666")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 188 days of Propose 2', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            secondIpfsHash,
            amountVotesToTally,
            dayOfTally
          );

          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            secondIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("599999999999999999")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("266666666666666666")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("1099999999999999999")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 188 days of Propose 3', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            thirdIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            thirdIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(185).to.equal(actual.day);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 190st day(Proposal voting is finished)', async() => {
        beforeEach(async () => {
          // day 181 (180 days required to unlock staking)
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

          // day 182
          await _TimeContract.setCurrentTimeIndex(182);
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

          // day 183
          await _TimeContract.setCurrentTimeIndex(183);
          await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2);
          await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf3, voteOptions2Of3);

          // day 184
          await _TimeContract.setCurrentTimeIndex(184);
          await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter2.address, BigInt(voterAmount));
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);

          // day 185
          await _TimeContract.setCurrentTimeIndex(185);
          await _VaultContract.connect(owner).unlock(voter3.address, BigInt(voterAmount));

          // day 186
          await _TimeContract.setCurrentTimeIndex(186);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 187
          await _TimeContract.setCurrentTimeIndex(187);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 188
          await _TimeContract.setCurrentTimeIndex(188);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 189
          await _TimeContract.setCurrentTimeIndex(189);
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, blankVoting);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 190
          await _TimeContract.setCurrentTimeIndex(190);

          // day 191
          await _TimeContract.setCurrentTimeIndex(191);
        });

        const day = 190;
        const dayOfTally = 190;
        const amountVotesToTally = 3;
        const index = 3;

        it('should return proposal status for 190 days of Propose 1', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          );

          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);

          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);
          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("1000000000000000000")).to.equal(actual.blankVotingAmount);
          expect(BigInt("333333")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 188 days of Propose 2', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            secondIpfsHash,
            amountVotesToTally,
            dayOfTally
          );

          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            secondIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(188).to.equal(actual.day);
          expect(BigInt("599999999999999999")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("266666666666666666")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("1099999999999999999")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 188 days of Propose 3', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            thirdIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            thirdIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(185).to.equal(actual.day);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('Should emit event including ipfsHash, day', async () => {
          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              amountVotesToTally,
              dayOfTally
            )
          ).to.emit(
            _GovernanceContract, 'ResetAmountsForTally'
          ).withArgs(
            ipfsHash,
            day
          );
        });

        it('Should emit event including ipfsHash, amountVotesToTally', async () => {
          const firstAmountVotesToTally = 2;
          const firstFinalizedProposalCurrentBatchIndex = 2;

          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              firstAmountVotesToTally,
              dayOfTally
            )
          ).to.emit(
            _GovernanceContract, 'Tally'
          ).withArgs(
            ipfsHash,
            day,
            firstAmountVotesToTally,
            firstFinalizedProposalCurrentBatchIndex
          );
        });

        it('Should emit event including ipfsHash, amountVotesToTally', async () => {
          const firstAmountVotesToTally = 2;
          const firstFinalizedProposalCurrentBatchIndex = 2;
          const secondAmountVotesToTally = 1;
          const secondFinalizedProposalCurrentBatchIndex = 3;

          await _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            firstAmountVotesToTally,
            dayOfTally
          );

          await expect(
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              secondAmountVotesToTally,
              dayOfTally
            )
          ).to.emit(
            _GovernanceContract, 'TallyComplete'
          ).withArgs(
            ipfsHash,
            day,
            secondAmountVotesToTally,
            secondFinalizedProposalCurrentBatchIndex
          );
        });
      });

      context('when talling the 191st day', async() => {
        beforeEach(async () => {
          // day 181 (180 days required to unlock staking)
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

          // day 182
          await _TimeContract.setCurrentTimeIndex(182);
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

          // day 183
          await _TimeContract.setCurrentTimeIndex(183);
          await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2);
          await _GovernanceContract.connect(voter3).vote(ipfsHashNumberOf3, voteOptions2Of3);

          // day 184
          await _TimeContract.setCurrentTimeIndex(184);
          await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter2.address, BigInt(voterAmount));
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);

          // day 185
          await _TimeContract.setCurrentTimeIndex(185);
          await _VaultContract.connect(owner).unlock(voter3.address, BigInt(voterAmount));

          // day 186
          await _TimeContract.setCurrentTimeIndex(186);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 187
          await _TimeContract.setCurrentTimeIndex(187);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 188
          await _TimeContract.setCurrentTimeIndex(188);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 189
          await _TimeContract.setCurrentTimeIndex(189);
          await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, blankVoting);
          await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
          await _VaultContract.connect(owner).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

          // day 190
          await _TimeContract.setCurrentTimeIndex(190);

          // day 191
          await _TimeContract.setCurrentTimeIndex(191);

          // day 192
          await _TimeContract.setCurrentTimeIndex(192);
        });

        const day = 190;
        const dayOfTally = 191;
        const amountVotesToTally = 3;
        const index = 3;

        it('should return proposal status for 191 days', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            ipfsHash,
            amountVotesToTally,
            dayOfTally
          );

          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);
          expect(true).to.equal(actual.completed);
          expect(day).to.equal(actual.day);

          expect(BigInt("333333333333333333")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("1000000000000000000")).to.equal(actual.blankVotingAmount);
          expect(BigInt("333333")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 190 days of Propose 2', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            secondIpfsHash,
            amountVotesToTally,
            dayOfTally
          );

          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            secondIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(188).to.equal(actual.day);
          expect(BigInt("599999999999999999")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("266666666666666666")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("1099999999999999999")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 190 days of Propose 3', async () => {
          _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
            thirdIpfsHash,
            amountVotesToTally,
            dayOfTally
          );
          const actual = await _GovernanceContract.connect(voter1).getTallyStatus(
            thirdIpfsHash,
            day
          );

          expect(true).to.equal(actual.completed);
          expect(185).to.equal(actual.day);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[0]);
          expect(BigInt("1000000000000000000")).to.equal(actual.votingAmounts[1]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[2]);
          expect(BigInt("0")).to.equal(actual.votingAmounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingAmount);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        context('when talling number of votes on proposal is finished)', async() => {
          it('Fail: Governance', async () => {
            _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
              ipfsHash,
              amountVotesToTally,
              dayOfTally
            );

            const actual = await _GovernanceContract.connect(voter1).getTallyStatus(ipfsHash, day);

            await expect(
              _GovernanceContract.connect(tallyExecuter).tallyNumberOfVotesOnProposal(
                ipfsHash,
                amountVotesToTally,
                dayOfTally
              )
            ).to.be.revertedWith("Tally number of votes on proposal has already finished");
          });
        });
      });
    });
  });
});
