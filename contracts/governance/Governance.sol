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

    mapping(bytes32 => bool) validatingIpfsHash;
    mapping(bytes32 => mapping(address => VotingHistory)) latestVoteOfUserOnProposal;

    bytes32 public constant ISSUE_PROPOSER_ROLE = keccak256("ISSUE_PROPOSER_ROLE");
    uint _proposalLength;
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

        _proposalLength = _proposalList.length;
        validatingIpfsHash[ipfsHash] = true;

        emit Propose(
            ipfsHash,
            optionNumber,
            minimumStakingAmount,
            multipleVote,
            startVotingDay,
            endVotingDay
        );
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

    /**
     * @notice Gets status of proposal.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   Number of day.
     */
    function getProposalStatus(bytes32 ipfsHash, uint day) override external view returns (ProposalStatus memory) {
        require(validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");

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
    function getVotingPowerOfDay(uint day, address voterAddress) override external view returns(uint256) {
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

    /**
     * @notice vote for proposal.
     * @notice In "selection", the numbers of the choices are entered sequentially from 1.
     * @notice example: If you select options 1, 2, and 3 for a proposal, "selection" will be [1, 2, 3].
     *
     * @param issue_number          Proposal number.
     * @param selection             Array for option number to vote.
     */
    function vote(uint256 issue_number, uint[] calldata selection) override external {
        uint[] memory votingOptions = selection;
        uint256 totalStakingAmount = getVotingPower(msg.sender);

        require(_proposalLength >= issue_number, "Governance: Proposal issune number is wrong");

        Proposal memory selectedPropose = _proposalList[issue_number];
        bytes32 ipfsHash = selectedPropose.ipfsHash;
        uint voteOptionsLength = votingOptions.length;
        uint today = _timeContract.getCurrentTimeIndex();

        require(selectedPropose.startVotingDay <= today, "Governance: Proposal voting is not start");
        require(today < selectedPropose.endVotingDay, "Governance: Proposal voting is finished");
        require(_checkVotingOptions(selection), "Governance: voting Options is invalid");
        require(totalStakingAmount >= selectedPropose.minimumStakingAmount, "Governance: Insufficient minimum staking amount");

        if ( !selectedPropose.multipleVote ) {
            require (voteOptionsLength <= 1, "Governance: No Single votes.");
        }

        latestVoteOfUserOnProposal[ipfsHash][msg.sender] = VotingHistory(
            today,
            msg.sender,
            totalStakingAmount,
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

    /**
     * @notice Gets latest voting history.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param voterAddress          Address of voter.
     */
    function getLatestVoteOfUserOnProposal(bytes32 ipfsHash, address voterAddress) override external view returns (VotingHistory memory) {
        require(validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");

        return latestVoteOfUserOnProposal[ipfsHash][voterAddress];
    }
}
