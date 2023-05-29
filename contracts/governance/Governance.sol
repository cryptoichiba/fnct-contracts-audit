// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../staking/interfaces/ITime.sol";
import "../staking/interfaces/IVault.sol";
import "../staking/interfaces/IGovernance.sol";
import "../staking/utils/UnrenounceableOwnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
// todo: remove debug tool
import "hardhat/console.sol";

contract GovernanceContract is IGovernance, AccessControl, UnrenounceableOwnable {
    ITime private immutable _timeContract;
    IVault private immutable _vaultContract;

    mapping(bytes32 => Proposal) _proposal;
    mapping(bytes32 => address[]) _proposalVoters;
    mapping(bytes32 => bool) _validatingIpfsHash;
    mapping(bytes32 => mapping(address => VotingHistory)) _latestVoteOfUserOnProposal;
    mapping(bytes32 => mapping(uint => TallyStatus)) _tallyStatus;
    mapping(bytes32 => mapping(uint => uint256)) finalizedProposalCurrentBatchIndex;

    bytes32 public constant ISSUE_PROPOSER_ROLE = keccak256("ISSUE_PROPOSER_ROLE");
    bytes32 public constant TALLY_VOTING_ROLE = keccak256("TALLY_VOTING_ROLE");
    uint private partsPerMillion = 1000000;
    uint _proposalLength;
    uint _proposalVoterNumver;
    Proposal[] _proposalList;

    /**
     * @notice Constructor
     *
     * @param timeContract_         Address of Time contract.
     * @param vaultContract_        Address of VaultContract.
     */
    constructor(address timeContract_, address vaultContract_) {
        require(timeContract_ != address(0x0), "Governance: TimeContract is zero address");
        require(vaultContract_ != address(0x0), "Governance: VaultContract is zero address");

        _timeContract = ITime(timeContract_);
        _vaultContract = IVault(vaultContract_);
    }

    /**
     * @notice Grant permission to propose function.
     *
     * @param  authorizedAddress    Address of granted permission.
     */
    function setupIssueProposerRole(address authorizedAddress) external onlyOwner {
        _grantRole(ISSUE_PROPOSER_ROLE, authorizedAddress);
    }

    /**
     * @notice Grant permission to tallyNumberOfVotesOnProposal function.
     *
     * @param  authorizedAddress    Address of granted permission.
     */
    function setupTallyVotingRole(address authorizedAddress) external onlyOwner {
        _grantRole(TALLY_VOTING_ROLE, authorizedAddress);
    }

    /**
     * @notice Record proposal contents on the blockchain
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param optionNumber          Number of proposal's option number.
     * @param minimumStakingAmount  Minimum staking amount to vote.
     * @param multipleVote          Possibility of multiple votes.
     * @param startVotingDay        Voting start day.
     * @param endVotingDay          Voting end day.
     */
    function propose(
        bytes32 ipfsHash,
        uint optionNumber,
        uint256 minimumStakingAmount,
        bool multipleVote,
        uint startVotingDay,
        uint endVotingDay
    ) override onlyRole(ISSUE_PROPOSER_ROLE) external {
        require(optionNumber != 0, "Governance: OptionNumber is invalid.");
        require(startVotingDay < endVotingDay, "Governance: startVotingDay or endVotingDay is wrong");
        uint today = _timeContract.getCurrentTimeIndex();
        require(_checkStartToEndDay(today, startVotingDay), "Governance: startVotingDay is wrong");

        _proposalList.push(
            Proposal(
                ipfsHash,
                optionNumber,
                minimumStakingAmount,
                multipleVote,
                startVotingDay,
                endVotingDay
            )
        );

        _proposal[ipfsHash] = Proposal(
            ipfsHash,
            optionNumber,
            minimumStakingAmount,
            multipleVote,
            startVotingDay,
            endVotingDay
        );

        _proposalLength = _proposalList.length;
        _validatingIpfsHash[ipfsHash] = true;

        emit Propose(
            ipfsHash,
            optionNumber,
            minimumStakingAmount,
            multipleVote,
            startVotingDay,
            endVotingDay
        );
    }

    /**
     * @notice get Proposal
     *
     * @param ipfsHash              Hash value of ipfs.
     */
    function getProposal(bytes32 ipfsHash) override external view returns (Proposal memory){
        require(_validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");
        return _proposal[ipfsHash];
    }

    function _findPropose(bytes32 ipfsHash) internal view returns(Proposal memory) {
        Proposal memory selectedPropose;
        for (uint i = 0; i < _proposalLength; i++ ) {
            if ( _proposalList[i].ipfsHash == ipfsHash ) {
                selectedPropose = _proposalList[i];
                break;
            }
        }

        return selectedPropose;
    }

    function _calcBlankVotingRate(bytes32 ipfsHash, uint day) internal view returns(uint) {
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint256 allBlankAmount = _tallyStatus[ipfsHash][day].blankVotingAmount;
        uint256 allVotingAmount;
        uint blankVotingRate;

        for ( uint i = 0; i < selectedPropose.optionNumber; i++ ) {
            allVotingAmount += _tallyStatus[ipfsHash][day].votingAmounts[i];
        }

        if (allVotingAmount == 0) return 0;

        blankVotingRate = allBlankAmount * partsPerMillion / (allVotingAmount + allBlankAmount);

        return blankVotingRate;
    }

    /**
     * @notice Gets status of proposal.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   Number of day.
     */
    function getProposalStatus(bytes32 ipfsHash, uint day) override external view returns (ProposalStatus memory) {
        require(_validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");

        Proposal memory selectedPropose = _findPropose(ipfsHash);
        ProposalStatus memory proposalStatus;
        Status status;

        if (_checkStartToEndDay(selectedPropose.startVotingDay, day)) {
            status = Status.ongoing;
        } else if (_checkStartToEndDay(selectedPropose.endVotingDay, day)) {
            status = Status.close;
        }

        proposalStatus.status = Status(status);

        return proposalStatus;
    }

    /**
     * @notice Gets list of proposal.
     *
     * @param from                  Number of index for data.
     * @param quantity              Number of data.
     */
    function getProposalList(uint from, uint quantity) override external view returns(Proposal[] memory) {
        uint recordCount;
        uint count;
        for ( uint i = 0; i < quantity ; i++ ) {
            if (_proposalLength == from + i) break;

            if (_proposalList[from + i].ipfsHash != 0) {
                recordCount++;
            }
        }

        uint length = quantity;
        if ( quantity > recordCount ) {
            length = recordCount;
        }

        Proposal[] memory selectedProposalList = new Proposal[](length);

        for ( uint i = 0; i < length; i++ ) {
            if (_proposalList[from + i].ipfsHash != 0) {
                selectedProposalList[i] = _proposalList[from + i];
                count++;
            }
        }

        return _trim(selectedProposalList, count);
    }

    function _trim(Proposal[] memory elements, uint length) pure internal returns(Proposal[] memory) {
        Proposal[] memory outs = new Proposal[](length);

        for ( uint i = 0; i < length; i++ ) {
            outs[i] = elements[i];
        }

        return outs;
    }

    function _checkStartToEndDay(uint startDay, uint endDay) internal pure returns(bool) {
        return startDay <= endDay;
    }

    /**
     * @notice Gets staking amount.
     *
     * @param voterAddress          Address of voter.
     */
    function getVotingPower(address voterAddress) public view returns(uint256) {
        return _vaultContract.calcLock(voterAddress);
    }

    /**
     * @notice Gets staking amount for specified date.
     *
     * @param day                   Number of day.
     * @param voterAddress          Address of voter.
     */
    function getVotingPowerOfDay(uint day, address voterAddress) public view returns(uint256) {
        return _vaultContract.calcLockOfDay(day, voterAddress);
    }

    function _checkVotingOptions(uint[] memory votingOptions) internal pure returns(bool) {
      uint length = votingOptions.length;
      bool result = false;

      if (length == 0) return true;

      for ( uint i = 0; i < length; i++ ) {
          if (votingOptions[i] <= 0) break;

          if (i == length - 1) {
              result = true;
          }
      }

      return result;
    }

    function _calcVotingAmountPerOption(uint256 totalStakingAmount, uint[] memory voteOptions) internal pure returns(uint256) {
        if (voteOptions.length == 0) return 0;
        uint length = voteOptions.length;
        uint256 votingAmountPerOption = totalStakingAmount / length;
        return votingAmountPerOption;
    }

    /**
     * @notice vote for proposal.
     * @notice In "selection", the numbers of the choices are entered sequentially from 1.
     * @notice example: If you select options 1, 2, and 3 for a proposal, "selection" will be [1, 2, 3].
     *
     * @param issue_number          Proposal number.
     * @param selection             Array for option number to vote.
     */
    function vote(uint256 issue_number, uint[] calldata selection) override external {
        require(_proposalLength >= issue_number, "Governance: Proposal issune number is wrong");
        Proposal memory selectedPropose = _proposalList[issue_number];
        bytes32 ipfsHash = selectedPropose.ipfsHash;
        uint[] memory votingOptions = selection;
        uint voteOptionsLength = votingOptions.length;
        uint today = _timeContract.getCurrentTimeIndex();
        uint256 totalStakingAmount = getVotingPowerOfDay(today, msg.sender);

        require(selectedPropose.startVotingDay <= today, "Governance: Proposal voting is not start");
        require(today < selectedPropose.endVotingDay, "Governance: Proposal voting is finished");
        require(_checkVotingOptions(selection), "Governance: voting Options is invalid");
        require(totalStakingAmount >= selectedPropose.minimumStakingAmount, "Governance: Insufficient minimum staking amount");

        if ( !selectedPropose.multipleVote ) {
            require (voteOptionsLength <= 1, "Governance: No Single votes.");
        }

        if (_latestVoteOfUserOnProposal[ipfsHash][msg.sender].day == 0) {
            _proposalVoters[ipfsHash].push(msg.sender);
            _proposalVoterNumver++;
        }

        _latestVoteOfUserOnProposal[ipfsHash][msg.sender] = VotingHistory(
            today,
            msg.sender,
            votingOptions
        );

        emit VotePropose(
            ipfsHash,
            msg.sender,
            today,
            totalStakingAmount,
            votingOptions
        );
    }

    function _getDay(bytes32 ipfsHash, uint day) internal view returns(uint) {
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint endVotingDay = selectedPropose.endVotingDay;

        if (day < endVotingDay){
          return day;
        }

        return endVotingDay;
    }

    function _getRecordCount(bytes32 ipfsHash, uint quantity, uint day) internal view returns(uint) {
        uint recordCount = quantity;
        uint index = finalizedProposalCurrentBatchIndex[ipfsHash][day];
        uint unfinalizedVotersCount = _proposalVoterNumver - index;

        if ( quantity > unfinalizedVotersCount ) {
            recordCount = unfinalizedVotersCount;
        }

        return recordCount;
    }

    function _calcVotingAmounts(
        bytes32 ipfsHash,
        uint day,
        uint[] memory voteOptions,
        uint256 votingAmountPerOption
    ) internal {
        for ( uint i = 0; i < voteOptions.length; i++ ) {
            uint index = voteOptions[i] - 1;
            _tallyStatus[ipfsHash][day].votingAmounts[index] += votingAmountPerOption;
        }
    }

    function _calcBlankVotingAmount(
        bytes32 ipfsHash,
        uint day,
        uint256 blankVotingAmount
    ) internal {
        _tallyStatus[ipfsHash][day].blankVotingAmount += blankVotingAmount;
    }

    function _resetToVotingAmounts(
        bytes32 ipfsHash,
        uint day,
        uint optionNumber
    ) internal {
        for ( uint i = 0; i < optionNumber; i++ ) {
            _tallyStatus[ipfsHash][day].votingAmounts.push(0);
        }

        emit ResetAmountsForTally(ipfsHash, day);
    }

    /**
     * @notice tally number of votes on proposal.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param amountVotesToTally    Amount votes to tally.
     */
    function tallyNumberOfVotesOnProposal(
        bytes32 ipfsHash,
        uint amountVotesToTally
    ) override onlyRole(TALLY_VOTING_ROLE) external {
        require(_validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");

        uint today = _timeContract.getCurrentTimeIndex();
        uint tallyDay = _getDay(ipfsHash, today);
        require(_tallyStatus[ipfsHash][tallyDay].completed == false, "Tally number of votes on proposal has already finished");

        Proposal memory selectedPropose = _findPropose(ipfsHash);

        uint recordCount = _getRecordCount(ipfsHash, amountVotesToTally, tallyDay);

        if (finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay] == 0) {
            _resetToVotingAmounts(
                ipfsHash,
                tallyDay,
                selectedPropose.optionNumber
            );
        }

        for ( uint i = 0; i < recordCount; i++ ) {
            uint index = finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay] + i;
            address voterAddress = _proposalVoters[ipfsHash][index];
            uint256 stakingAmount = getVotingPowerOfDay(tallyDay, voterAddress);

            if (stakingAmount < selectedPropose.minimumStakingAmount) continue;

            VotingHistory memory votingHistory = _latestVoteOfUserOnProposal[ipfsHash][voterAddress];
            uint[] memory voteOptions = votingHistory.voteOptions;
            uint256 stakingAmountPerOption = _calcVotingAmountPerOption(
                stakingAmount,
                voteOptions
            );

            if (voteOptions.length > 0) {
                _calcVotingAmounts(
                    ipfsHash,
                    tallyDay,
                    voteOptions,
                    stakingAmountPerOption
                );
            } else {
                _calcBlankVotingAmount(
                    ipfsHash,
                    tallyDay,
                    stakingAmount
                );
            }
        }

        finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay] += recordCount;

        _tallyStatus[ipfsHash][tallyDay].blankVotingRate = _calcBlankVotingRate(
            ipfsHash,
            tallyDay
        );

        if (finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay] == _proposalVoterNumver) {
            _tallyStatus[ipfsHash][tallyDay].completed = true;
            emit TallyComplete(
              ipfsHash,
              today,
              amountVotesToTally,
              finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay]
            );
        }

        _tallyStatus[ipfsHash][tallyDay].day = tallyDay;
        _tallyStatus[ipfsHash][tallyDay].tallyIndex = finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay];

        emit Tally(
          ipfsHash,
          today,
          amountVotesToTally,
          finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay]
        );
    }

    /**
     * @notice Gets status of tallyNumberOfVotesOnProposal method.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   day of execute tally.
     */
    function getTallyStatus(bytes32 ipfsHash, uint day) override external view returns (TallyStatus memory) {
        require(_validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");
        return _tallyStatus[ipfsHash][day];
    }

    /**
     * @notice Gets latest voting history.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param voterAddress          Address of voter.
     */
    function getLatestVoteOfUserOnProposal(bytes32 ipfsHash, address voterAddress) override external view returns (VotingHistory memory) {
        require(_validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");

        return _latestVoteOfUserOnProposal[ipfsHash][voterAddress];
    }
}
