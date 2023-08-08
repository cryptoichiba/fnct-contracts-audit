// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../fixed_interfaces/IFixedGovernance.sol";

interface IGovernance is IFixedGovernance {
    struct Proposal {
        bytes32 ipfsHash;
        uint optionNumber;
        uint256 minimumStakingAmount;
        bool multipleVote;
        uint startVotingDay;
        uint endVotingDay;
    }

    struct VotingHistory {
        uint day;
        address voterAddress;
        uint[] voteOptions;
    }

    struct ProposalStatus {
        Status status;
    }

    struct TallyStatus {
        bool completed;
        uint day;
        uint tallyIndex;
        uint256[] votingAmounts;
        uint256 blankVotingAmount;
        uint blankVotingRate;
    }

    enum Status {
        before,
        ongoing,
        close
    }

    event IssueProposerRoleGranted(address indexed ownerAddress, address indexed authorizedAddress);
    event IssueProposerRoleRevoked(address indexed ownerAddress, address indexed revokedAddress);
    event TallyVotingRoleGranted(address indexed ownerAddress, address indexed authorizedAddress);
    event TallyVotingRoleRevoked(address indexed ownerAddress, address indexed revokedAddress);
    event MinimumStakeAmountRangeUpdated(uint min, uint max);
    event VotingPeriodRangeUpdated(uint min, uint max);
    event MaxOptionNumberUpdated(uint maxNumber);
    event VotePropose(bytes32 indexed ipfsHash, address indexed voter, uint day, uint256 totalAmount, uint[] voteOptions);
    event Propose(bytes32 ipfsHash, uint optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint startVotingDay, uint endVotingDay);
    event ResetAmountsForTally(bytes32 ipfsHash, uint day);
    event Tally(bytes32 ipfsHash, uint day, uint amountVotesToTally, uint finalizedProposalCurrentBatchIndex);
    event TallyComplete(bytes32 ipfsHash, uint day, uint amountVotesToTally, uint finalizedProposalCurrentBatchIndex);

    function setMinimumStakeAmountRange(uint min, uint max) external;
    function setVotingPeriodRange(uint min, uint max) external;
    function setMaxOptionNumber(uint maxNumber) external;
    function propose(bytes32 ipfsHash, uint optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint startVotingDay, uint endVotingDay) external;
    function getProposal(bytes32 ipfsHash) external view returns(Proposal memory);
    function getProposalNumber(bytes32 ipfsHash) external view returns(uint);
    function getProposalStatus(bytes32 ipfsHash, uint day) external view returns(ProposalStatus memory);
    function getProposalList(uint from, uint quantity) external view returns(Proposal[] memory);
    function vote(uint256 issue_number, uint[] calldata selection) external;
    function getLatestVoteOfUserOnProposal(bytes32 ipfsHash, address voterAddress) external view returns (VotingHistory memory);
    function tallyNumberOfVotesOnProposal(bytes32 ipfsHash, uint256 amountVotesToTally) external;
    function getTallyStatus(bytes32 ipfsHash, uint day) external view returns (TallyStatus memory);
}
