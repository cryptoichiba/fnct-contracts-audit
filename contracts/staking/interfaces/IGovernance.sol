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
        uint256[] amounts;
        uint blankVotingRate;
    }

    struct TallyStatus {
        bool status;
        uint day;
        uint tallyNumber;
    }

    enum Status {
        before,
        ongoing,
        close
    }

    event VotePropose(bytes32 indexed ipfsHash, address indexed voter, uint[] voteOptions);
    event Propose(bytes32 ipfsHash, uint optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint startVotingDay, uint endVotingDay);
    event TallyVotingComplete(bytes32 ipfsHash, uint day);
    event TallyVoting(bytes32 ipfsHash, uint day, uint from, uint to);

    function propose(bytes32 ipfsHash, uint optionNumber, uint256 minimumStakingAmount, bool multipleVote, uint startVotingDay, uint endVotingDay) external;
    function getProposalStatus(bytes32 ipfsHash, uint day) external view returns(ProposalStatus memory);
    function getProposalList(uint from, uint quantity) external view returns(Proposal[] memory);
    function vote(uint256 issue_number, uint[] calldata selection) external;
    function tallyVoting(bytes32 ipfsHash, uint day, uint from, uint to) external;
    function getTallyVotingResult(bytes32 ipfsHash, uint day) external view returns (TallyStatus memory);
    function getVotedHistory(bytes32 ipfsHash, address voterAddress, uint from, uint quantity) external view returns(VotingHistory[] memory);
    function getVotedList(bytes32 ipfsHash, uint from, uint quantity) external view returns(VotingHistory[] memory);
}
