// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IGovernance {
    struct Proposal {
        bytes32 ipfsHash;
        uint optionNumber;
        bool multipleVote;
        bool startVotingTimestamp;
        bool endVotingTimestamp;
    }

    struct Voting {
        address voterAddress;
        uint[] amounts;
    }

    event VotePropose(address indexed voter, bytes32 indexed ipfsHash, uint[] voteAmounts);

    function propose(bytes32 ipfsHash, uint optionNumber, bool multipleVote) external;
    function getProposalStatus(bytes32 ipfsHash) external view returns(string memory);
    function getProposalList(uint256 fromTimestamp, uint256 quantity) external view returns(Proposal[] memory);
    function votePropose(bytes32 ipfsHash, optionId uint8) external;
    function getVotedPower() returns();
    function getVotedHisory(bytes32 ipfsHash, address voterAddress) external view returns(Voting[] memory);
    function getVotedList(bytes32 ipfsHash, uint256 fromLastVotingDay, uint256 quantity) external view returns(Voting[] memory);
    function findPropose(bytes32 ipfsHash) external view returns(Proposal memory);
}
