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

  const voteOptions = [1, 3, 4];
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  const ownerAmount = 5 * 10 ** 18;
  const voterAmount = 1 * 10 ** 18;
  const ipfsHashNumber = 0;

  const from = 1;
  const to = 2;

  const voteOptions1 = [1, 3, 4];
  const voteOptions2 = [1, 2, 4];
  const voteOptions3 = [2, 4];

  beforeEach(async () => {
    [owner, voter1, voter2, voter3, issueProposer] = await ethers.getSigners();

    const TimeContract = await ethers.getContractFactory('MockTimeContract');
    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await TimeContract.deploy(0, 0);
    await _TimeContract.deployed();

    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _GovernanceContract = await deployGovernanceContract(_TimeContract, _FNCToken, _VaultContract, false, owner);

    await _VaultContract.setupStakingRole(owner.address);
    await _VaultContract.setupStakingRole(voter1.address);
    await _VaultContract.setupStakingRole(voter2.address);
    await _VaultContract.setupStakingRole(voter3.address);

    await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(ownerAmount));
    await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
    await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
    await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));

    await _FNCToken.connect(owner).transfer(voter1.address, BigInt(voterAmount));
    await _FNCToken.connect(owner).transfer(voter2.address, BigInt(voterAmount));
    await _FNCToken.connect(owner).transfer(voter3.address, BigInt(voterAmount));
    await _VaultContract.connect(voter1).addLock(voter1.address, BigInt(voterAmount));
    await _VaultContract.connect(voter2).addLock(voter2.address, BigInt(voterAmount));
    await _VaultContract.connect(voter3).addLock(voter3.address, BigInt(voterAmount));

    await _GovernanceContract.connect(owner).setupIssueProposerRole(issueProposer.address);

  })

  it('Should deploy smart contract properly', async () => {
    expect(_GovernanceContract.address).not.to.equal('');
  })

  describe('propose', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(owner).setupIssueProposerRole(issueProposer.address);
    })

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
          ipfsHash, optionNumber, BigInt(minimumStakingAmount), multipleVote, startVotingDay, endVotingDay
        );
      })
    })

    context('When optionalNumber is 0', async() => {
      const optionNumber = 0;
      const multipleVote = true;

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
        ).to.be.revertedWith("Governance: OptionNumber is invalid.");
      })
    })

    context('When startVotingDay is more than endVotingDay', async() => {
      const startVotingDay = 10;
      const endVotingDay = 1;

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
        ).to.be.revertedWith("Governance: startVotingDay or endVotingDay is wrong");
      })
    })

    context('When startVoting is invalid', async() => {
      const startVotingDay = 0;

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
        ).to.be.revertedWith("Governance: startVotingDay is wrong");
      })
    })

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

      })
    })
  })

  describe('getProposalStatus', async () => {
    const endVotingDay = 200;
    const day = 1;

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
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1);
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions3);
    })

    context('When ipfsHash is valid', async() => {
      it('Should return proposal status', async () => {
        const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);

        expect(1).to.equal(actual.status);
        expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
        expect(BigInt("833333333333333333")).to.equal(actual.amounts[1]);
        expect(BigInt("333333333333333333")).to.equal(actual.amounts[2]);
        expect(BigInt("1166666666666666666")).to.equal(actual.amounts[3]);
      })
    })

    context('When staking amount changes ', async() => {
      const day = 1;
      const from = 0;
      const to = 2;

      context('When staking amount increases', async() => {
        beforeEach(async () => {
          await _FNCToken.connect(owner).approve(_VaultContract.address, BigInt(ownerAmount));
          await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
          await _FNCToken.connect(owner).transfer(voter1.address, BigInt(voterAmount));
          await _VaultContract.connect(voter1).addLock(voter1.address, BigInt(voterAmount));
        })

        it('Should return tallied proposal status', async () => {
          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to)
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);

          expect(1).to.equal(actual.status);
          expect(BigInt("999999999999999999")).to.equal(actual.amounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[1]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[2]);
          expect(BigInt("1499999999999999999")).to.equal(actual.amounts[3]);
        })
      })

      context('When staking amount decreases', async() => {
        const day = 181;
        beforeEach(async () => {
          await _TimeContract.setCurrentTimeIndex(181);
          await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));
        })

        it('Should return tallied proposal status', async () => {
          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[3]);
        })
      })
    })

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(owner).getProposalStatus(invalidIpfsHash, day)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      })
    })
  })

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
    })

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

  describe('vote', async () => {
    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(ipfsHash, optionNumber, BigInt(minimumStakingAmount), multipleVote, startVotingDay, endVotingDay);
    })

    context('When params is valid', async() => {
      it('Should emit event including msg.sender, ipfsHash, voteAmounts', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.emit(
          _GovernanceContract, 'VotePropose'
        ).withArgs(
          ipfsHash, voter1.address, voteOptions
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
          _GovernanceContract, 'VotePropose'
        ).withArgs(
          ipfsHash, voter1.address, secondVoteOptions
        );
      });
    });

    context('When blank voting', async() => {
      const blankVoting = [];
      const day = 1;
      const voteOptions1 = [1, 3, 4];
      const voteOptions2 = [1, 2, 4];
      const voteOptions3 = [2, 4];

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

        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1);
        await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);
        await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions3);

        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, blankVoting);
        await _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
      })

      it('Should return proposal status', async () => {
        const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);

        expect(1).to.equal(actual.status);
        expect(BigInt("333333333333333333")).to.equal(actual.amounts[0]);
        expect(BigInt("833333333333333333")).to.equal(actual.amounts[1]);
        expect(BigInt("0")).to.equal(actual.amounts[2]);
        expect(BigInt("833333333333333333")).to.equal(actual.amounts[3]);
        expect(333333).to.equal(actual.blankVotingRate);
      })
    });

    context('When ipfsHash is invalid', async() => {
      const invalidIpfsHashNumber = 2;

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(invalidIpfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: Proposal issune number is wrong");
      });
    });

    context('When multiVoting is false and voting amount is invalid', async() => {
      const ipfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';
      const multipleVote = false;
      const ipfsHashNumber = 1;

      beforeEach(async () => {
        await _GovernanceContract.connect(issueProposer).propose(ipfsHash, optionNumber, BigInt(minimumStakingAmount), multipleVote, startVotingDay, endVotingDay);;
      })

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
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
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
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
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
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
          _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
        ).to.be.revertedWith("Governance: voting Options is invalid");
      });
    });
  });

  describe('tallyVoting', async () => {
    const day = 1;
    const from = 0;
    const to = 2;

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
    });

    context('When params is valid', async() => {
      it('Should emit event including ipfsHash, day, from, to', async () => {
        await expect(
          _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
        ).to.emit(
          _GovernanceContract, 'TallyVoting'
        ).withArgs(
          ipfsHash, day, from, to
        );
      });

      it('Should emit event including ipfsHash, day', async () => {
        await expect(
          _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
        ).to.emit(
          _GovernanceContract, 'TallyVotingComplete'
        ).withArgs(
          ipfsHash, day
        );
      });
    });

    context('When tallyVoting has already been executed', async() => {
      beforeEach(async () => {
        await _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to);
      });

      it('Fail: Governance', async () => {
        await expect(
          _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
        ).to.be.revertedWith("Governance: Specified day's tally has ended");
      });
    });
  });

  describe('getTallyVotingResult', async () => {
    const day = 1;
    const voteOptions1 = [1, 3, 4];
    const voteOptions2 = [1, 2, 4];
    const voteOptions3 = [2, 4];

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

      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1);
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions3);
    });

    context('When execute method with all voter', async() => {
      const from = 0;
      const to = 2;

      beforeEach(async () => {
        _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
      });

      it('Should return true status', async () => {
        const actual = await _GovernanceContract.connect(voter1.address).getTallyVotingResult(ipfsHash, day);

        expect(true).to.equal(actual.status);
        expect(1).to.equal(actual.day);
        expect(3).to.equal(actual.tallyNumber);
      });
    });

    context('When execute method with specific voter', async() => {
      const from = 0;
      const to = 1;

      beforeEach(async () => {
        _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
      });

      it('Should return true status', async () => {
        const actual = await _GovernanceContract.connect(voter1.address).getTallyVotingResult(ipfsHash, day);

        expect(false).to.equal(actual.status);
        expect(1).to.equal(actual.day);
        expect(2).to.equal(actual.tallyNumber);
      });
    });
  });

  describe('getVotedHistory', async () => {
    const previousVoteOptions = [1, 3];
    const previousVotingAmountPerOption = voterAmount / previousVoteOptions.length;
    const latestVoteOptions = [1, 2, 4];
    const latestVotingAmountPerOption = "333333333333333333";
    const from = 1;
    const quantity = 2;

    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(
        ipfsHash,
        optionNumber,
        BigInt(minimumStakingAmount),
        multipleVote,
        startVotingDay,
        endVotingDay);

      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions)
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, previousVoteOptions)
      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, latestVoteOptions)
    });

    context('When params is valid', async() => {
      it('Should return voting history', async () => {
        const actual = await _GovernanceContract.connect(voter1.address).getVotedHistory(ipfsHash, voter1.address, from, quantity);

        expect(1).to.equal(actual[0].day);
        expect(voter1.address).to.equal(actual[0].voterAddress);
        expect(BigInt(voterAmount)).to.equal(actual[0].votingAmount);
        expect(previousVoteOptions[0]).to.equal(actual[0].voteOptions[0]);
        expect(previousVoteOptions[1]).to.equal(actual[0].voteOptions[1]);

        expect(1).to.equal(actual[1].day);
        expect(voter1.address).to.equal(actual[1].voterAddress);
        expect(BigInt(voterAmount)).to.equal(actual[1].votingAmount);
        expect(latestVoteOptions[0]).to.equal(actual[1].voteOptions[0]);
        expect(latestVoteOptions[1]).to.equal(actual[1].voteOptions[1]);
        expect(latestVoteOptions[2]).to.equal(actual[1].voteOptions[2]);
      });
    });

    context('When params is invalid', async() => {
      it('Should return voting history', async () => {

        await expect(
            _GovernanceContract.connect(voter1.address).getVotedHistory(ipfsHash, zeroAddress, from, quantity)
        ).to.be.revertedWith("Governance: voter address is zero address");
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';

      it('Fail: Governance', async () => {
        await expect(
            _GovernanceContract.connect(voter1.address).getVotedHistory(invalidIpfsHash, voter1.address, from, quantity)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('getVotedList', async () => {
    const voteOptions1 = [1, 3, 4];
    const voteOptions2 = [1, 2, 4];
    const voteOptions3 = [2, 4];
    const from = 1;
    const quantity = 4;

    beforeEach(async () => {
      await _TimeContract.setCurrentTimeIndex(1);
      await _GovernanceContract.connect(issueProposer).propose(ipfsHash, optionNumber, BigInt(minimumStakingAmount), multipleVote, startVotingDay, endVotingDay);

      await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1)
      await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2)
      await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions3)
    });

    context('When params is valid', async() => {
      it('Should return voting history', async () => {
        const actual = await _GovernanceContract.connect(owner).getVotedList(ipfsHash, from, quantity);

        expect(1).to.equal(actual[0].day);
        expect(voter2.address).to.equal(actual[0].voterAddress);
        expect(BigInt(voterAmount)).to.equal(actual[0].votingAmount);
        expect(voteOptions2[0]).to.equal(actual[0].voteOptions[0]);
        expect(voteOptions2[1]).to.equal(actual[0].voteOptions[1]);
        expect(voteOptions2[1]).to.equal(actual[0].voteOptions[1]);

        expect(1).to.equal(actual[1].day);
        expect(voter3.address).to.equal(actual[1].voterAddress);
        expect(BigInt(voterAmount)).to.equal(actual[1].votingAmount);
        expect(voteOptions3[0]).to.equal(actual[1].voteOptions[0]);
        expect(voteOptions3[1]).to.equal(actual[1].voteOptions[1]);
      });
    });

    context('When params is invalid', async() => {
      const invalidIpfsHash = '0xb94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde8';

      it('Should return voting history', async () => {
        await expect(
            _GovernanceContract.connect(owner).getVotedList(invalidIpfsHash, from, to)
        ).to.be.revertedWith("Governance: ipfs hash is wrong");
      });
    });
  });

  describe('Use case testing', async () => {
    const endVotingDay = 190;

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

    context('when voting period is 10 days and talling is performed multiple times during that period', async() => {
      const voter3DailyStakingAmount = 0.2 * 10 ** 18;
      const blankVoting = [];

      beforeEach(async () => {
        // day 1
        await _TimeContract.setCurrentTimeIndex(1);
        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions1);
        await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);
        await _GovernanceContract.connect(voter3).vote(ipfsHashNumber, voteOptions3);

        // day 181 (180 days required to unlock staking)
        await _TimeContract.setCurrentTimeIndex(181);
        await _VaultContract.connect(owner).unlock(voter1.address, BigInt(voterAmount));

        // day 182
        await _TimeContract.setCurrentTimeIndex(182);
        await _FNCToken.connect(voter1).approve(_VaultContract.address, BigInt(voterAmount));
        await _VaultContract.connect(voter1).addLock(voter1.address, BigInt(voterAmount));
        await _VaultContract.connect(owner).unlock(voter2.address, BigInt(voterAmount));

        // day 183
        await _TimeContract.setCurrentTimeIndex(183);
        await _GovernanceContract.connect(voter1).vote(ipfsHashNumber, voteOptions2);

        // day 184
        await _TimeContract.setCurrentTimeIndex(184);
        await _FNCToken.connect(voter2).approve(_VaultContract.address, BigInt(voterAmount));
        await _VaultContract.connect(voter2).addLock(voter2.address, BigInt(voterAmount));
        await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, voteOptions2);

        // day 185
        await _TimeContract.setCurrentTimeIndex(185);
        await _VaultContract.connect(owner).unlock(voter3.address, BigInt(voterAmount));

        // day 186
        await _TimeContract.setCurrentTimeIndex(186);
        await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
        await _VaultContract.connect(voter3).addLock(voter3.address, BigInt(voter3DailyStakingAmount));
        await _VaultContract.connect(voter3).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

        // day 187
        await _TimeContract.setCurrentTimeIndex(187);
        await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
        await _VaultContract.connect(voter3).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

        // day 188
        await _TimeContract.setCurrentTimeIndex(188);
        await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
        await _VaultContract.connect(voter3).addLock(voter3.address, BigInt(voter3DailyStakingAmount));

        // day 189
        await _TimeContract.setCurrentTimeIndex(189);
        await _GovernanceContract.connect(voter2).vote(ipfsHashNumber, blankVoting);
        await _FNCToken.connect(voter3).approve(_VaultContract.address, BigInt(voterAmount));
        await _VaultContract.connect(voter3).addLock(voter3.address, BigInt(voter3DailyStakingAmount));
      });

      context('when talling the 182st day', async() => {
        it('should return proposal status for 182 days', async () => {
          const day = 182;
          const from = 0;
          const to = 2;

          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[0]);
          expect(BigInt("500000000000000000")).to.equal(actual.amounts[1]);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 184st day', async() => {
        it('should return proposal status for 184 days', async () => {
          const day = 184;
          const from = 0;
          const to = 2;

          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
          expect(BigInt("1166666666666666666")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("1166666666666666666")).to.equal(actual.amounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 185st day', async() => {
        context('when executing tallyVoting from 0 to 1', async() => {
          it('should return proposal status for 185 days from 0 to 1', async () => {
            const day = 185;
            const from = 0;
            const to = 1;

            _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
            const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
            expect(1).to.equal(actual.status);
            expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
            expect(BigInt("1166666666666666666")).to.equal(actual.amounts[1]);
            expect(BigInt("0")).to.equal(actual.amounts[2]);
            expect(BigInt("1166666666666666666")).to.equal(actual.amounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });
        });

        context('when executing tallyVoting from 1 to 2', async() => {
          const day = 185;
          const from1 = 0;
          const to1 = 1;
          const from2 = 1;
          const to2 = 2;

          it('should return proposal status for 185 days from 1 to 2', async () => {
            _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
            const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
            expect(1).to.equal(actual.status);
            expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
            expect(BigInt("666666666666666666")).to.equal(actual.amounts[1]);
            expect(BigInt("0")).to.equal(actual.amounts[2]);
            expect(BigInt("666666666666666666")).to.equal(actual.amounts[3]);
            expect(BigInt("0")).to.equal(actual.blankVotingRate);
          });

          it('Should emit event including ipfsHash, day, from, to', async () => {
            await expect(
              _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
            ).to.emit(
              _GovernanceContract, 'TallyVoting'
            ).withArgs(
              ipfsHash, day, from, to
            );
          });

          it('Should emit event including ipfsHash, day', async () => {
            await _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from1, to1);
            await expect(
              _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from2, to2)
            ).to.emit(
              _GovernanceContract, 'TallyVotingComplete'
            ).withArgs(
              ipfsHash, day
            );
          });
        });
      });

      context('when talling the 186st day', async() => {
        it('should return proposal status for 186 days', async () => {
          const day = 186;
          const from = 0;
          const to = 2;

          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 188st day', async() => {
        it('should return proposal status for 188 days', async () => {
          const day = 188;
          const from = 0;
          const to = 2;

          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });

      context('when talling the 190st day(Proposal voting is finished)', async() => {
        const day = 190;
        const from = 0;
        const to = 2;

        it('should return proposal status for 190 days', async () => {
          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[3]);
          expect(BigInt("333333")).to.equal(actual.blankVotingRate);
        });

        it('Should emit event including ipfsHash, day, from, to', async () => {
          await expect(
            _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
          ).to.emit(
            _GovernanceContract, 'TallyVoting'
          ).withArgs(
            ipfsHash, day, from, to
          );
        });

        it('Should emit event including ipfsHash, day', async () => {
          await expect(
            _GovernanceContract.connect(voter1).tallyVoting(ipfsHash, day, from, to)
          ).to.emit(
            _GovernanceContract, 'TallyVotingComplete'
          ).withArgs(
            ipfsHash, day
          );
        });
      });

      context('when talling the 189st day, the 182st day and the 186st day', async() => {
        it('should return proposal status for 189 days', async () => {
          const day = 189;
          const from = 0;
          const to = 2;
          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[0]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[3]);
          expect(BigInt("333333")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 182 days', async () => {
          const day = 182;
          const from = 0;
          const to = 2;
          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[0]);
          expect(BigInt("500000000000000000")).to.equal(actual.amounts[1]);
          expect(BigInt("333333333333333333")).to.equal(actual.amounts[2]);
          expect(BigInt("833333333333333333")).to.equal(actual.amounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });

        it('should return proposal status for 186 days', async () => {
          const day = 186;
          const from = 0;
          const to = 2;
          _GovernanceContract.connect(owner).tallyVoting(ipfsHash, day, from, to);
          const actual = await _GovernanceContract.connect(voter1).getProposalStatus(ipfsHash, day);
          expect(1).to.equal(actual.status);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[0]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[1]);
          expect(BigInt("0")).to.equal(actual.amounts[2]);
          expect(BigInt("666666666666666666")).to.equal(actual.amounts[3]);
          expect(BigInt("0")).to.equal(actual.blankVotingRate);
        });
      });
    });
  });
});
