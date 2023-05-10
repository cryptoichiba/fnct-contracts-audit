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
        uint256 votingAmount;
        uint[] voteOptions;
    }

    struct ProposalStatus {
        Status status;
    }

    enum Status {
        before,
        ongoing,
        close
    }

    event VotePropose(bytes32 indexed ipfsHash, address indexed voter, uint day, uint256 totalAmount, uint[] voteOptions);
    event Propose(bytes32 ipfsHash, uint optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint startVotingDay, uint endVotingDay);

    function propose(bytes32 ipfsHash, uint optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint startVotingDay, uint endVotingDay) external;
    function getProposalStatus(bytes32 ipfsHash, uint day) external view returns(ProposalStatus memory);
    function getProposalList(uint from, uint quantity) external view returns(Proposal[] memory);
    function getVotingPowerOfDay(uint day, address voterAddress) external returns(uint256);
    function vote(uint256 issue_number, uint[] calldata selection) external;
    function getLatestVoteOfUserOnProposal(bytes32 ipfsHash, address voterAddress) external view returns (VotingHistory memory);
}
