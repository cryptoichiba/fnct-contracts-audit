// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../fixed_interfaces/IFixedGovernance.sol";

interface IGovernance is IFixedGovernance {
    struct Proposal {
        bytes32 ipfsHash;
        uint256 optionNumber;
        uint256 minimumStakingAmount;
        bool multipleVote;
        uint256 startVotingDay;
        uint256 endVotingDay;
    }

    struct VotingHistory {
        uint256 day;
        address voterAddress;
        uint256[] voteOptions;
    }

    struct ProposalStatus {
        Status status;
    }

    struct TallyStatus {
        bool completed;
        uint256 day;
        uint256[] votingAmounts;
        uint256 blankVotingAmount;
        uint256 blankVotingRate;
    }

    enum Status {
        BEFORE,
        ONGOING,
        CLOSE
    }

    event IssueProposerRoleGranted(address indexed ownerAddress, address indexed authorizedAddress);
    event IssueProposerRoleRevoked(address indexed ownerAddress, address indexed revokedAddress);
    event TallyVotingRoleGranted(address indexed ownerAddress, address indexed authorizedAddress);
    event TallyVotingRoleRevoked(address indexed ownerAddress, address indexed revokedAddress);
    event MinimumStakeAmountRangeUpdated(uint256 min, uint256 max);
    event VotingPeriodRangeUpdated(uint256 min, uint256 max);
    event MaxOptionNumberUpdated(uint256 maxNumber);
    event VotedOnProposal(bytes32 indexed ipfsHash, address indexed voter, uint256 day, uint256 totalAmount, uint256[] voteOptions);
    event Propose(bytes32 ipfsHash, uint256 optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint256 startVotingDay, uint256 endVotingDay);
    event ResetAmountsForTally(bytes32 ipfsHash, uint256 day);
    event Tally(bytes32 ipfsHash, uint256 day, uint256 amountVotesToTally, uint256 finalizedProposalCurrentBatchIndex);
    event TallyComplete(bytes32 ipfsHash, uint256 day, uint256 amountVotesToTally, uint256 finalizedProposalCurrentBatchIndex);

    function setMinimumStakeAmountRange(uint256 min, uint256 max) external;
    function setVotingPeriodRange(uint256 min, uint256 max) external;
    function setMaxOptionNumber(uint256 maxNumber) external;
    function propose(bytes32 ipfsHash, uint256 optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint256 startVotingDay, uint256 endVotingDay) external;
    function getProposalNumber(bytes32 ipfsHash) external view returns(uint256);
    function getProposalStatus(bytes32 ipfsHash, uint256 day) external view returns(Status);
    function getProposalList(uint256 from, uint256 quantity) external view returns(Proposal[] memory);
    function vote(uint256 issue_number, uint256[] calldata selection) external;
    function getLatestVoteOfUserOnProposal(bytes32 ipfsHash, address voterAddress) external view returns (VotingHistory memory);
    function tallyNumberOfVotesOnProposal(bytes32 ipfsHash, uint256 amountVotesToTally, uint dayOfTally) external;
    function getTallyStatus(bytes32 ipfsHash, uint256 day) external view returns (TallyStatus memory);
}
