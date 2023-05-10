const {expect} = require('chai');
const {ethers} = require('hardhat');
const {deployFNCToken, deployVaultContract, deployGovernanceContract} = require('./support/deploy');

describe('GovernanceContract', () => {
  const ipfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
  const optionNumber = 4;
  const multipleVote = true;
  const startVotingDay = 1;
  const endVotingDay = 10;
  const minimumStakingAmount = 1 * 10 ** 18;
  const day = 1;

  const voteOptions = [1, 3, 4];
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  const ownerAmount = 5 * 10 ** 18;
  const voterAmount = 1 * 10 ** 18;
  const ipfsHashNumber = 0;

  beforeEach(async () => {
    [owner, voter, issueProposer] = await ethers.getSigners();

    const TimeContract = await ethers.getContractFactory('MockTimeContract');
    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await TimeContract.deploy(0, 0);
    await _TimeContract.deployed();

    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _GovernanceContract = await deployGovernanceContract(_TimeContract, _FNCToken, _VaultContract, false, owner);

    await _VaultContract.setupStakingRole(owner.address);

    await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(ownerAmount));
    await _FNCToken.connect(voter).approve(_VaultContract.address, BigInt(voterAmount));

    await _FNCToken.connect(owner).transfer(voter.address, BigInt(voterAmount));
    await _VaultContract.connect(owner).addLock(voter.address, BigInt(voterAmount));

    await _GovernanceContract.connect(owner).setupIssueProposerRole(issueProposer.address);
  });

  it('Should deploy smart contract properly', async () => {
    expect(_GovernanceContract.address).not.to.equal('');
  });

  describe('propose', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(owner).setupIssueProposerRole(issueProposer.address);
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

    context('When execute method by unprivileged user', async() => {
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter).propose(
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
  });

  describe('getProposalStatus', async () => {
    const endVotingDay = 200;

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
      await _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions);
    });

    context('When ipfsHash is valid', async() => {
      it('Should return proposal status', async () => {
        const actual = await _GovernanceContract.connect(voter).getProposalStatus(ipfsHash, day);

        expect(1).to.equal(actual.status);
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
    const quantity = 6;

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
      })
    })
  });

  describe('getVotingPowerOfDay', async () => {
    const day = 1;
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(day);
    });

    context('When params is valid', async() => {
      it('Should return staking amount', async () => {
        const actual = await _GovernanceContract.connect(voter).getVotingPowerOfDay(day, voter.address);
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
          _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions)
        ).to.emit(
          _GovernanceContract, 'VotePropose'
        ).withArgs(
          ipfsHash, voter.address, day, BigInt(voterAmount), voteOptions
        );
      });
    });

    context('When second vote', async() => {
      const secondVoteOptions = [1, 4];

      beforeEach(async () => {
        await _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions);
      })

      it('Should emit event including msg.sender, ipfsHash, voteAmounts', async () => {
        await expect(
          _GovernanceContract.connect(voter).vote(ipfsHashNumber, secondVoteOptions)
        ).to.emit(
          _GovernanceContract, 'VotePropose'
        ).withArgs(
          ipfsHash, voter.address, day, BigInt(voterAmount), secondVoteOptions
        );
      });
    });

    context('When ipfsHash is invalid', async() => {
      const invalidIpfsHashNumber = 2;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter).vote(invalidIpfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal issune number is wrong");
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
          _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: No Single votes.");
      });
    });

    context('When proposal voting is not start', async() => {
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
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal voting is not start");
      });
    });

    context('Governance: Proposal voting is finished', async() => {
      beforeEach(async () => {
        await _GovernanceContract.connect(issueProposer).propose(
          ipfsHash,
          optionNumber,
          BigInt(minimumStakingAmount),
          multipleVote,
          startVotingDay,
          endVotingDay
        );
        await _TimeContract.setCurrentTimeIndex(11);
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal voting is finished");
      });
    });

    context('Voting Options is invalid ', async() => {
      const voteOptions = [0, 1, 3];

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
          _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: voting Options is invalid");
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
      await _GovernanceContract.connect(voter).vote(ipfsHashNumber, voteOptions);
    });

    context('When params is valid', async() => {
      it('Should return voting history', async () => {
        const actual = await _GovernanceContract.connect(voter).getLatestVoteOfUserOnProposal(ipfsHash, voter.address);

        expect(day).to.equal(actual.day);
        expect(voter.address).to.equal(actual.voterAddress);
        expect(BigInt(voterAmount)).to.equal(BigInt(actual.votingAmount));
        expect(voteOptions[0]).to.equal(actual.voteOptions[0]);
        expect(voteOptions[1]).to.equal(actual.voteOptions[1]);
        expect(voteOptions[2]).to.equal(actual.voteOptions[2]);
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';

      it('Should return voting history', async () => {
        await expect(
          _GovernanceContract.connect(voter).getLatestVoteOfUserOnProposal(
            invalidIpfsHash,
            voter.address
          )
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });
});
