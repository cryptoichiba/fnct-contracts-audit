// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../staking/interfaces/ITime.sol";
import "../staking/interfaces/IGovernance";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract GovernanceContract is IGovernance, AccessControl {
    ITime private immutable _timeContract;

    mapping(bytes32 => address[]) _voters;
    mapping(bytes32 => mapping(address => uint[]) _votingHistory;
    mapping(bytes32 => mapping(uint => uint256)) _totalVotingAmount;
    mapping(bytes32 => mapping(uint => uint[])) _totalVotingAmountHistory;
    mapping(address => uint) _lastVotingDay;

    Proposal[] _proposalList;

    constructor(address timeContract_) {
        require(timeContract_ != address(0x0), "Governance: TimeContract is zero address");

        _timeContract = ITime(timeContract_);
    }

    // 構造化したハッシュ値
    // (タイトル / テキスト / 選択肢のテキスト)
    // 結果に関わる設定の個別値
    // (単数複数 / 選択肢の個数 / 最低ロック数 / 定足数 / 通過基準 / 開始日 / 終了日)
    function propose(bytes32 ipfsHash, uint optionNumber, bool multipleVote, uint startVotingTimestamp, uint endVotingTimestamp) override external {
        if (multipleVote) {
            require(optionNumber >= 1, "Governance: Multiple vote is enable. (1 or more option)");
        } else {
            require(optionNumber <= 1, "Governance:  Multiple vote is disanable. (1 or less options)");
        }

        require(startVotingTimestamp < endVotingTimestamp, "Governance: startVotingTimestamp or endVotingTimestamp is wrong");
        require(startVotingTimestamp > block.timestamp, "Governance: startVotingTimestamp is wrong");
        require(endVotingTimestamp > block.timestamp, "Governance: startVotingTimestamp is wrong");

        _proposalList.push(Proposal(ipfsHash, optionNumber, multipleVote, startVotingTimestamp, endVotingTimestamp));
    }

    // 投票受付状況: before / ongoing / closed
    // 選択肢毎の合計得票数: votePower (ユニーク) 投票締め切りステーク数
    function getProposalStatus(bytes32 ipfsHash) override external view returns (string memory){
      require(findPropose(bytes32 ipfsHash) != 0, "Governance: ipfs hash is wrong");
      Proposal memory selectedPropose = findPropose(bytes32 ipfsHash);

      if (selectedPropose.startVotingTimestamp > block.timestamp) {
        return 'before'
      } else if (block.timestamp > selectedPropose.startVotingTimestamp && selectedPropose.endVotingTimestamp > block.timestamp) {
        return 'ongoing'
      } else if (block.timestamp > selectedPropose.startVotingTimestamp) {
        return 'close'
      }
    }

    // 提案一覧（pagination）
    function getProposalList(uint256 fromTimestamp, uint256 quantity) override external view returns(Proposal[] memory) {
        Proposal[] memory _selectedProposalList;

         for ( uint i = 0; i < _proposalList.length; i++ ) {
            if ( _proposalList[i].startVotingTimestamp > fromTimestamp) {
                _selectedProposalList[i] = _proposalList[i];
            }
        }

        uint256 length = quantity;
        if ( quantity > _selectedProposalList.length ) {
            length = _selectedProposalList.length;
        }

        Proposal[] memory specificProposalList = new Proposal[](length);
        for ( uint256 i = 0; i < length; i++ ) {
            specificProposalList[i] = _selectedProposalList[i];
        }

        return specificProposalList;
    }

    function votePropose(bytes32 ipfsHash, uint[] voteAmounts ) {
        require(findPropose(bytes32 ipfsHash) != 0, "Governance: ipfs hash is wrong");
        Proposal memory selectedPropose = findPropose(bytes32 ipfsHash);

        if ( !selectedPropose.multipleVote ) {
          // example: voteAmounts[100, 0, 100 , 0]
          require (checkSingleVoting(voteAmounts), "Governance: No Single votes.")
        }

        uint today = _timeContract.getCurrentTimeIndex();

        if ( _votingHistory[ipfsHash][msg.sender].length != 0 ) {
            for ( uint i = 0; i < _votingHistory[ipfsHash][msg.sender].length; i++ ) {
                _totalVotingAmount[ipfsHash][i] -= _votingHistory[ipfsHash][msg.sender][i];
                _totalVotingAmountHistory[ipfsHash][today][i] = _totalVotingAmount[ipfsHash][i];
            }
        }

        _voters[ipfsHash].push(msg.sender);
        _lastVotingDay[msg.sender] = today;

        for ( uint i = 0; i < voteAmounts.length; i++ ) {
            _totalVotingAmount[ipfsHash][i] += voteAmounts[i];
            _totalVotingAmountHistory[ipfsHash][today][i] = _totalVotingAmount[ipfsHash][i];
        }

        emit VotePropose(msg.sender, ipfsHash, voteAmounts);
    }

    function findPropose(bytes32 ipfsHash) override external view returns(Proposal memory) {
        Proposal memory selectedPropose;
        for ( uint i = 0; i < _proposalList.length; i++ ) {
            if ( _proposalList[i].ipfsHash == ipfsHash ) {
                selectedPropose = _proposalList[i];
                break;
            }
        }

        return selectedPropose;
    }

    function checkSingleVoting(uint[] voteAmounts) {
        uint memory count = 0;
        bool memory result = true;

        for ( uint i = 0; i <= voteAmounts.length ; i++ ) {
           if ( voteAmounts[i] > 0 ) {
               count++;
           }

           if ( count > 1) {
              result = false;
              break;
           }
        }

        return result;
    }

    // 該当voterの投票力: ステーク数(current)
    function getVotedPower(bytes32 ipfsHash, address voterAddress) override external view returns() {

    }

    // voter毎の投票履歴(pagination)
    function getVotedHisory(bytes32 ipfsHash, address voterAddress) override external view returns(Voting memory) {
        require(voterAddress != address(0x0), "Governance: voter address is zero address");
        require(findPropose(ipfsHash) != 0, "Governance: ipfs hash is wrong");

        uint[] amounts = _votingHistory[ipfsHash][voterAddress];
        Voting memory votingHistory = new Voting;
        votingHistory = Voting(voterAddress, amounts);
        return votingHistory
    }

    // 提案に紐づくアドレス毎の投票選択肢
    // 誰がどの提案に何票を投票したか
    function getVotedList(bytes32 ipfsHash, uint256 fromLastVotingDay, uint256 quantity) override external view returns(Voting[] memory) {
        require(findPropose(ipfsHash) != 0, "Governance: ipfs hash is wrong");

        Voting[] memory _selectedVotingList;
        address memory votersAddresses =_voters[ipfsHash]

         for ( uint i = 0; i < votersAddresses.length; i++ ) {
            if ( fromLastVotingDay < _lastVotingDay[votersAddresses[i]]) {
                _selectedVotingList[i] = votersAddresses[i];
            }
        }

        uint256 length = quantity;
        if ( quantity > _selectedVotingList.length ) {
            length = _selectedVotingList.length;
        }

        Voting[] memory VotingList = new Voting[](length);

        for ( uint i = 0; i <= length ; i++ ) {
          address memory voterAddress = _selectedVotingList[i];
          VotingList.push(Voting(voterAddress, _votingHistory[ipfsHash][voterAddress]));
        }

        return VotingList;
    }
}
