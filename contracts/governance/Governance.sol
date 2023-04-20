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

    mapping(bytes32 => address[]) _voters;
    mapping(bytes32 => mapping(uint => uint)) _dailyVoters;
    mapping(address => mapping(bytes32 => VotingHistory[])) _votingHistory;
    mapping(address => bool) _blankVoter;
    mapping(bytes32 => mapping(uint => uint256)) _blankVotePower;
    mapping(bytes32 => mapping(uint => uint256)) _totalVotingAmount;
    mapping(bytes32 => mapping(uint => mapping(uint => uint256))) _specificTotalVotingAmount;
    mapping(bytes32 => mapping(uint => bool)) _completeTallyVoting;
    mapping(bytes32 => mapping(uint => address[])) _tallyNumber;

    bytes32 public constant ISSUE_PROPOSER_ROLE = keccak256("ISSUE_PROPOSER_ROLE");
    uint private partsPerMillion = 1000000;

    uint _proposalLength;
    Proposal[] _proposalList;

    constructor(address timeContract_, address vaultContract_) {
        require(timeContract_ != address(0x0), "Governance: TimeContract is zero address");
        require(vaultContract_ != address(0x0), "Governance: VaultContract is zero address");

        _timeContract = ITime(timeContract_);
        _vaultContract = IVault(vaultContract_);
    }

    function setupIssueProposerRole(address authorizedAddress) external onlyOwner {
        _grantRole(ISSUE_PROPOSER_ROLE, authorizedAddress);
    }

    // 構造化したハッシュ値
    // (タイトル / テキスト / 選択肢のテキスト)
    // 結果に関わる設定の個別値
    // (単数複数 / 選択肢の個数 / 最低ロック数 / 定足数 / 通過基準 / 開始日 / 終了日)
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

    // 投票受付状況: before / ongoing / closed
    // 選択肢毎の合計得票数: votePower (ユニーク) 投票締め切りステーク数
    function getProposalStatus(bytes32 ipfsHash, uint day) override external view returns (ProposalStatus memory) {
        require(_findPropose(ipfsHash).ipfsHash != 0, "Governance: ipfs hash is wrong");

        Proposal memory selectedPropose = _findPropose(ipfsHash);
        ProposalStatus memory proposalStatus;
        Status status;

        uint length = selectedPropose.optionNumber;
        uint256 [] memory votingAmounts = new uint256[](length);

        if (_checkStartToEndDay(selectedPropose.startVotingDay, day)) {
            status = Status.ongoing;
        } else if (_checkStartToEndDay(selectedPropose.endVotingDay, day)) {
            status = Status.close;
        }

        for ( uint i = 0; i < length; i++ ) {
              votingAmounts[i] = _specificTotalVotingAmount[ipfsHash][day][i];
        }

        proposalStatus.status = Status(status);
        proposalStatus.amounts = votingAmounts;
        proposalStatus.blankVotingRate = _calcBlankVotingRate(ipfsHash, day);

        return proposalStatus;
    }

    // 提案一覧（pagination）
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

        Proposal[] memory trimmedProposalList = new Proposal[](count);

        for ( uint i = 0; i < count; i++ ) {
            trimmedProposalList[i] = selectedProposalList[i];
        }

        return trimmedProposalList;
    }

    function _checkStartToEndDay(uint startDay, uint endDay) internal pure returns(bool) {
        return startDay <= endDay;
    }

    // 該当voterの投票力: ステーク数(current)
    function getVotedPower(address voterAddress) public view returns(uint256) {
        return _vaultContract.calcLock(voterAddress);
    }

    function _calcVotingAmountPerOption(uint256 totalStakingAmount, uint[] memory voteOptions) internal pure returns(uint256) {
        if (voteOptions.length == 0) return 0;
        uint length = voteOptions.length;
        uint256 votingAmountPerOption = totalStakingAmount / length;
        return votingAmountPerOption;
    }

    function _getLastVotingHistory(bytes32 ipfsHash, address voterAddress) internal view returns(VotingHistory memory) {
        uint recordCount = _votingHistory[voterAddress][ipfsHash].length;
        return _votingHistory[voterAddress][ipfsHash][recordCount - 1];
    }

    function _checkBlankVoting(
        bytes32 ipfsHash,
        uint day,
        uint voteOptionsLength,
        address voterAddress,
        uint256 totalStakingAmount
    ) internal {
        if (_blankVoter[voterAddress] && voteOptionsLength > 0) {
            _blankVotePower[ipfsHash][day] -= totalStakingAmount;
            _blankVoter[voterAddress] = false;
        }

        if (voteOptionsLength == 0) {
            _blankVoter[voterAddress] = true;
            _blankVotePower[ipfsHash][day] += totalStakingAmount;
        }
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

    // In "selection", the numbers of the choices are entered sequentially from 1.
    // exm: If you select options 1, 2, and 3 for a proposal, "selection" will be [1, 2, 3].
    function vote(uint256 issue_number, uint[] calldata selection) override external {
        require(_proposalLength >= issue_number, "Governance: Proposal issune number is wrong");
        Proposal memory selectedPropose = _proposalList[issue_number];

        uint today = _timeContract.getCurrentTimeIndex();
        require(selectedPropose.startVotingDay <= today, "Governance: Proposal voting is not start");
        require(today < selectedPropose.endVotingDay, "Governance: Proposal voting is finished");
        require(_checkVotingOptions(selection), "Governance: voting Options is invalid");

        uint[] memory votingOptions = selection;
        uint voteOptionsLength = votingOptions.length;
        bytes32 ipfsHash = selectedPropose.ipfsHash;
        uint256 totalStakingAmount = getVotedPower(msg.sender);

        require(totalStakingAmount >= selectedPropose.minimumStakingAmount, "Governance: Insufficient minimum staking amount");

        uint256 votingAmountPerOption = _calcVotingAmountPerOption(
            totalStakingAmount,
            votingOptions
        );

        if ( !selectedPropose.multipleVote ) {
            require (1 >= voteOptionsLength, "Governance: No Single votes.");
        }

        _checkBlankVoting(
            ipfsHash,
            today,
            voteOptionsLength,
            msg.sender,
            totalStakingAmount
        );

        if (_votingHistory[msg.sender][ipfsHash].length > 0) {
            VotingHistory memory previosVotingHistory = _getLastVotingHistory(ipfsHash, msg.sender);
            uint256 previosVotingAmountPerOption = _calcVotingAmountPerOption(
                previosVotingHistory.votingAmount,
                previosVotingHistory.voteOptions
            );

            for ( uint i = 0; i < previosVotingHistory.voteOptions.length; i++ ) {
                uint index = previosVotingHistory.voteOptions[i] - 1;
                _totalVotingAmount[ipfsHash][index] -= previosVotingAmountPerOption;
            }
        }

        if (_votingHistory[msg.sender][ipfsHash].length == 0) {
            _voters[ipfsHash].push(msg.sender);
            _dailyVoters[ipfsHash][today]++;
        }

        _votingHistory[msg.sender][ipfsHash].push(
            VotingHistory(
                today,
                msg.sender,
                totalStakingAmount,
                votingOptions
            )
        );

        for ( uint i = 0; i < voteOptionsLength; i++ ) {
            uint index = votingOptions[i] - 1;
            _totalVotingAmount[ipfsHash][index] += votingAmountPerOption;
        }

        for ( uint i = 0; i < selectedPropose.optionNumber; i++ ) {
            _specificTotalVotingAmount[ipfsHash][today][i] = _totalVotingAmount[ipfsHash][i];
        }

        emit VotePropose(ipfsHash, msg.sender, selection);
    }

    function _getSpecificVotingHistory(bytes32 ipfsHash, address voterAddress, uint day) internal view returns(VotingHistory memory) {
        uint recordCount = _votingHistory[voterAddress][ipfsHash].length;
        VotingHistory memory votingHistory;
        for ( uint i = recordCount - 1; i >= 0; i-- ) {
            if (_votingHistory[voterAddress][ipfsHash][i].day <= day ){
              votingHistory = _votingHistory[voterAddress][ipfsHash][i];
              break;
            }

            if ( i == 0 ) break;
        }

        return votingHistory;
    }

    function _subtraction(
        bytes32 ipfsHash,
        uint day,
        uint[] memory voteOptions,
        uint256 votingAmountPerOption
    ) internal {
        for ( uint i = 0; i < voteOptions.length; i++ ) {
            uint index = voteOptions[i] - 1;
            _specificTotalVotingAmount[ipfsHash][day][index] -= votingAmountPerOption;
        }
    }

    function _addition(
        bytes32 ipfsHash,
        uint day,
        uint[] memory voteOptions,
        uint256 pastVotingAmountPerOption,
        uint256 newVotingAmountPerOption
    ) internal {
        for ( uint i = 0; i < voteOptions.length; i++ ) {
            uint index = voteOptions[i] - 1;
            _specificTotalVotingAmount[ipfsHash][day][index] -= pastVotingAmountPerOption;
            _specificTotalVotingAmount[ipfsHash][day][index] += newVotingAmountPerOption;
        }
    }

    function _calcSpecificTotalVotingAmount(bytes32 ipfsHash, uint day) internal {
        require(_findPropose(ipfsHash).ipfsHash != 0, "Governance: ipfs hash is wrong");

        uint length = _voters[ipfsHash].length;

        for ( uint i = 0; i < length; i++ ) {
            address voterAddress = _voters[ipfsHash][i];
            VotingHistory memory pastVotingHistory = _getSpecificVotingHistory(
                ipfsHash,
                voterAddress,
                day
            );

            uint[] memory voteOptions = pastVotingHistory.voteOptions;

            uint256 votingAmountPerOption = _calcVotingAmountPerOption(
                pastVotingHistory.votingAmount,
                voteOptions
            );

            for ( uint j = 0; j < voteOptions.length; j++ ) {
                uint index = voteOptions[j] - 1;
                _specificTotalVotingAmount[ipfsHash][day][index] += votingAmountPerOption;
            }
        }
    }

    function _getVoterNumber(bytes32 ipfsHash, uint day) internal view returns(uint) {
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint voterNumber;

        for ( uint i = day; selectedPropose.startVotingDay <= i; i-- ) {
            voterNumber += _dailyVoters[ipfsHash][i];
            if ( i == 0 ) break;
        }

        return voterNumber;
    }

    function _checkSpecificTotalVotingAmount(bytes32 ipfsHash, uint day) internal view returns(bool) {
        require(_findPropose(ipfsHash).ipfsHash != 0, "Governance: ipfs hash is wrong");
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint length = selectedPropose.optionNumber;
        bool result = true;

        for ( uint i = 0; i < length; i++ ) {
          if (_specificTotalVotingAmount[ipfsHash][day][i] != 0) {
              result = false;
              break;
          }
        }

        return result;
    }

    function _checkTalliedAddress(bytes32 ipfsHash, uint day, address voterAddress) internal view returns(bool) {
        uint length = _tallyNumber[ipfsHash][day].length;
        bool result = false;

        for ( uint i = 0; i < length; i++ ) {
            if (_tallyNumber[ipfsHash][day][i] == voterAddress) {
                result = true;
                break;
            }
        }

        return result;
    }


    function tallyVoting(bytes32 ipfsHash, uint day, uint from, uint to) override external {
        uint recordCount = to - from + 1;
        require(!_completeTallyVoting[ipfsHash][day], "Governance: Specified day's tally has ended" );

        if (_checkSpecificTotalVotingAmount(ipfsHash, day)) {
            _calcSpecificTotalVotingAmount(ipfsHash, day);
        }

        uint voterNumber = _getVoterNumber(ipfsHash, day);

        for ( uint i = 0; i < recordCount; i++ ) {
            address voterAddress = _voters[ipfsHash][from + i];
            uint256 pastStakingAmount = _vaultContract.calcLockOfDay(day, voterAddress);
            VotingHistory memory pastVotingHistory = _getSpecificVotingHistory(ipfsHash, voterAddress, day);

            if (!_checkTalliedAddress(ipfsHash, day, voterAddress)) {
                _tallyNumber[ipfsHash][day].push(voterAddress);
            }

            if (pastStakingAmount == pastVotingHistory.votingAmount) continue;

            uint256 pastVotingAmountPerOption = _calcVotingAmountPerOption(
                pastVotingHistory.votingAmount,
                pastVotingHistory.voteOptions
            );

            uint256 newVotingAmountPerOption = _calcVotingAmountPerOption(
                pastStakingAmount,
                pastVotingHistory.voteOptions
            );

            Proposal memory selectedPropose = _findPropose(ipfsHash);

            if (pastStakingAmount < selectedPropose.minimumStakingAmount) {
                _subtraction(
                    ipfsHash,
                    day,
                    pastVotingHistory.voteOptions,
                    pastVotingAmountPerOption
                );
            } else {
                _addition(
                    ipfsHash,
                    day,
                    pastVotingHistory.voteOptions,
                    pastVotingAmountPerOption,
                    newVotingAmountPerOption
                );
            }
        }

        if (voterNumber == _tallyNumber[ipfsHash][day].length) {
            _completeTallyVoting[ipfsHash][day] = true;
            emit TallyVotingComplete(ipfsHash, day);
        }

        emit TallyVoting(ipfsHash, day, from, to);
    }

    function getTallyVotingResult(bytes32 ipfsHash, uint day) override external view returns (TallyStatus memory) {
        TallyStatus memory tallyStatus;
        tallyStatus.status = _completeTallyVoting[ipfsHash][day];
        tallyStatus.day = day;
        tallyStatus.tallyNumber = _tallyNumber[ipfsHash][day].length;

        return tallyStatus;
    }

    function _calcBlankVotingRate(bytes32 ipfsHash, uint day) internal view returns(uint) {
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint256 allVotingAmount;
        uint256 allBlankAmount;
        uint blankVotingRate;

        for ( uint i = 0; i < selectedPropose.optionNumber; i++ ) {
            allVotingAmount += _specificTotalVotingAmount[ipfsHash][day][i];
        }

        for ( uint i = day; i >= selectedPropose.startVotingDay; i-- ) {
            allBlankAmount += _blankVotePower[ipfsHash][i];
            if ( i == 0 ) break;
        }

        if (allVotingAmount == 0) return 0;

        blankVotingRate = allBlankAmount * partsPerMillion / (allVotingAmount + allBlankAmount);

        return blankVotingRate;
    }

    // voter毎の投票履歴(pagination)
    function getVotedHistory(
        bytes32 ipfsHash,
        address voterAddress,
        uint from,
        uint quantity
    ) override external view returns(VotingHistory[] memory) {
        require(_findPropose(ipfsHash).ipfsHash != 0, "Governance: ipfs hash is wrong");
        require(voterAddress != address(0x0), "Governance: voter address is zero address");

        uint length = quantity;
        uint recordCount = _votingHistory[voterAddress][ipfsHash].length;
        uint count = 0;

        if ( quantity > recordCount ) {
            length = recordCount;
        }

        VotingHistory[] memory selectedVotingHistory = new VotingHistory[](length);

        for ( uint i = 0; i < recordCount; i++ ) {
            if (recordCount == from + i) break;

            selectedVotingHistory[i] = VotingHistory(
                _votingHistory[voterAddress][ipfsHash][from + i].day,
                _votingHistory[voterAddress][ipfsHash][from + i].voterAddress,
                _votingHistory[voterAddress][ipfsHash][from + i].votingAmount,
                _votingHistory[voterAddress][ipfsHash][from + i].voteOptions
            );

            count++;
        }

        return _trim(selectedVotingHistory, count);
    }

    // 提案に紐づくアドレス毎の投票選択肢
    // 誰がどの提案に何票を投票したか
    function getVotedList(bytes32 ipfsHash, uint from, uint quantity) override external view returns(VotingHistory[] memory) {
        require(_findPropose(ipfsHash).ipfsHash != 0, "Governance: ipfs hash is wrong");

        uint length = quantity;
        uint recordCount = _voters[ipfsHash].length;
        uint count = 0;

        if ( quantity > recordCount ) {
            length = recordCount;
        }

        VotingHistory[] memory votingList = new VotingHistory[](length);

        for ( uint i = 0; i < recordCount; i++ ) {
            if (recordCount == from + i) break;

            address voterAddress = _voters[ipfsHash][from + i];
            votingList[i] = _getLastVotingHistory(ipfsHash, voterAddress);

            count++;
        }

        return _trim(votingList, count);
    }

    function _trim(VotingHistory[] memory elements, uint length) pure internal returns(VotingHistory[] memory) {
        VotingHistory[] memory outs = new VotingHistory[](length);

        for ( uint i = 0; i < length; i++ ) {
            outs[i] = elements[i];
        }

        return outs;
    }
}
