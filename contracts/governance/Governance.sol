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
    // variable to ensure _proposalHashToIndex is incremented each time a proposal is added
    uint private _currentIndexOfProposal;

    mapping(bytes32 => Proposal) _proposal;
    // variable to record the index number of each proposal
    mapping(bytes32 => uint) _proposalHashToIndex;
    mapping(bytes32 => address[]) _proposalVoters;
    mapping(bytes32 => bool) _validatingIpfsHash;
    // variable that records the number of unique voters for each proposal
    mapping(bytes32 => uint) _proposalVoterNumver;
    // variable that records a voter's latest voting history
    mapping(bytes32 => mapping(address => VotingHistory)) _latestVoteOfUserOnProposal;
    mapping(bytes32 => mapping(uint => TallyStatus)) _tallyStatus;
    // variable that records the current index of the next-to-be-processed voter
    mapping(bytes32 => mapping(uint => uint256)) finalizedProposalCurrentBatchIndex;

    bytes32 public constant ISSUE_PROPOSER_ROLE = keccak256("ISSUE_PROPOSER_ROLE");
    bytes32 public constant TALLY_VOTING_ROLE = keccak256("TALLY_VOTING_ROLE");
    uint private partsPerMillion = 1000000;
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
    function grantIssueProposerRole(address authorizedAddress) external onlyOwner {
        require(authorizedAddress != address(0x0), "Governance: Address is zero address");
        _grantRole(ISSUE_PROPOSER_ROLE, authorizedAddress);

        emit IssueProposerRoleGranted(msg.sender, authorizedAddress);
    }

    /**
     * @notice Revoke permission to propose function.
     *
     * @param  revokedAddress       Address of revok permission.
     */
    function revokeIssueProposerRole(address revokedAddress) external onlyOwner {
        require(revokedAddress != address(0x0), "Governance: Address is zero address");
        _revokeRole(ISSUE_PROPOSER_ROLE, revokedAddress);

        emit IssueProposerRoleRevoked(msg.sender, revokedAddress);
    }

    /**
     * @notice Grant permission to tallyNumberOfVotesOnProposal function.
     *
     * @param  authorizedAddress    Address of granted permission.
     */
    function grantTallyVotingRole(address authorizedAddress) external onlyOwner {
        require(authorizedAddress != address(0x0), "Governance: Address is zero address");
        _grantRole(TALLY_VOTING_ROLE, authorizedAddress);

        emit TallyVotingRoleGranted(msg.sender, authorizedAddress);
    }

    /**
     * @notice Revoke permission to tallyNumberOfVotesOnProposal function.
     *
     * @param  revokedAddress       Address of revok permission.
     */
    function revokeTallyVotingRole(address revokedAddress) external onlyOwner {
        require(revokedAddress != address(0x0), "Governance: Address is zero address");
        _revokeRole(ISSUE_PROPOSER_ROLE, revokedAddress);

        emit TallyVotingRoleRevoked(msg.sender, revokedAddress);
    }

    /**
     * @notice Record proposal contents on the blockchain
     * @notice
     * @notice [Example(Proposal)]
     * @notice   What NFT projects would you like finance.inc to publish next season?
     * @notice     - Option 1: Manga
     * @notice     - Option 2: Game
     * @notice     - Option 3: Anime
     * @notice     Multiple selection possible
     * @notice     Minimum staking amount is 100FNCT
     * @notice
     * @notice [Example(Voting)]
     * @notice   - User A(200 FNCT*): Select [1, 2]
     * @notice   - User B(100 FNCT*): Select [] (blank vote)
     * @notice   - User C(90 FNCT*): Select [3]
     * @notice     * User's staking amount
     * @notice   User A's voting is valid, 100 FNCT minutes will be voted for options 1 and 2.
     * @notice   User B's voting is valid, voted blank voting.
     * @notice   User C's voting is invalid due to less than minimum staking amount.
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
        require(today <= startVotingDay, "Governance: startVotingDay is wrong");
        require(!_validatingIpfsHash[ipfsHash], "Governance: specified ipfsHash is already registered");

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
        // added index number to extract specific proposal in _findPropose method.
        _proposalHashToIndex[ipfsHash] = _currentIndexOfProposal;
        _currentIndexOfProposal++;

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

    /**
     * @notice get Proposal number
     *
     * @param ipfsHash              Hash value of ipfs.
     */
    function getProposalNumber(bytes32 ipfsHash) override external view returns (uint){
        require(_validatingIpfsHash[ipfsHash], "Governance: ipfs hash is wrong");
        return _proposalHashToIndex[ipfsHash];
    }

    /**
     * @notice find Proposal
     *
     * @param ipfsHash              Hash value of ipfs.
     */
    function _findPropose(bytes32 ipfsHash) internal view returns(Proposal memory) {
        Proposal memory selectedPropose;
        uint proposalIndex = _proposalHashToIndex[ipfsHash];
        selectedPropose = _proposalList[proposalIndex];

        return selectedPropose;
    }

    /**
     * @notice calculate rate of blank voting
     * @notice Calculate parts per million of blank votes
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   Number of day.
     */
    function _calcBlankVotingRate(bytes32 ipfsHash, uint day) internal view returns(uint) {
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint256 allBlankAmount = _tallyStatus[ipfsHash][day].blankVotingAmount;
        uint256 allVotingAmount;
        uint blankVotingRate;

        for ( uint i = 0; i < selectedPropose.optionNumber; i++ ) {
            allVotingAmount += _tallyStatus[ipfsHash][day].votingAmounts[i];
        }

        if (allBlankAmount == 0) return 0;

        // Calculate the ratio of blank votes to total votes
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

        if (selectedPropose.endVotingDay < day) {
            status = Status.close;
        } else if (day < selectedPropose.startVotingDay) {
            status = Status.before;
        } else {
            status = Status.ongoing;
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
        require(from <= _proposalLength, "Governance: 'from' is greater than number of proposal");
        uint actualQuantity = quantity;

        if (from + quantity > _proposalLength) {
            actualQuantity = _proposalLength - from;
        }

        Proposal[] memory slicedProposal = new Proposal[](actualQuantity);

        for (uint i = 0; i < actualQuantity; i++) {
            slicedProposal[i] = _proposalList[from + i];
        }

        return slicedProposal;
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

    /**
     * @notice Check if voted option is correct.
     * @notice Return true if votingOptions is greater than "1 or more" or
     * @notice "array length is 0(blank voting)".
     *
     * @param votingOptions          The voting options(selection).
     */
    function _checkVotingOptions(uint[] memory votingOptions, uint optionNumber) internal pure returns(bool) {
      uint length = votingOptions.length;
      bool result = false;

      // Invalid if the number of voting options is greater than the number of propose options.
      if (length > optionNumber) return false;

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
     * @notice Calculate staking amount per option.
     * @notice Evenly distribute staking amount with options of the latest voting history.
     *
     * @param totalStakingAmount    Amount of Staking.
     * @param voteOptions           Options of voting.
     */
    function _calcVotingAmountPerOption(uint256 totalStakingAmount, uint[] memory voteOptions) internal pure returns(uint256) {
        if (voteOptions.length == 0) return 0;
        uint length = voteOptions.length;
        uint256 votingAmountPerOption = totalStakingAmount / length;
        return votingAmountPerOption;
    }

    /**
     * @notice Check if voting options are ascending and unique.
     * @notice Arrays with voting options like [1,1,2] and [3,2,1] are invalid.
     *
     * @param voteOptions           Options of voting.
     */
    function _validatingVoteOptions(uint[] memory voteOptions) internal pure returns(bool) {
      bool result = true;
      uint length = voteOptions.length;

      // If voteOptions is less than or equal to 1, return
      if (length < 2) return result;

      for(uint i = 0; i < length - 1; i++) {
          if (voteOptions[i] >= voteOptions[i + 1]) {
              result = false;
          }
      }

      return result;
    }

    /**
     * @notice Method: vote for proposal.
     * @notice
     * @notice Spec:
     * @notice   - In "selection", the numbers of the choices are entered sequentially from 1.
     * @notice   - Example: If you select options 1, 2, and 3 for a proposal, "selection" will be [1, 2, 3].
     * @notice   - Only users with minimum stake or higher can vote and User can vote multiple times.
     * @notice   - Votes for each proposal are evenly distributed by the number of stakes.
     * @notice   - Example: When stake number is 100 and "selection" is [1, 3], 50 will be distributed to options 1 and 3.
     *
     * @param issue_number          Proposal number.
     * @param selection             Array for option number to vote.
     */
    function vote(uint256 issue_number, uint[] calldata selection) override external {
        require(_proposalLength >= issue_number, "Governance: Proposal issune number is wrong");
        Proposal memory selectedPropose = _proposalList[issue_number];
        bytes32 ipfsHash = selectedPropose.ipfsHash;
        uint[] memory votingOptions = selection;

        require(_validatingVoteOptions(votingOptions), "Governance: Voting options must be ascending and unique");

        uint voteOptionsLength = votingOptions.length;
        uint today = _timeContract.getCurrentTimeIndex();
        uint256 totalStakingAmount = getVotingPowerOfDay(today, msg.sender);
        uint proposeOptionNumber = selectedPropose.optionNumber;

        // Users(staking users) can vote between startVotingDay and endVotingDay
        require(selectedPropose.startVotingDay <= today, "Governance: Proposal voting is not start");
        require(today < selectedPropose.endVotingDay, "Governance: Proposal voting is finished");
        require(_checkVotingOptions(selection, proposeOptionNumber), "Governance: voting Options is invalid");

        // Only users with minimum stake or higher can vote.
        require(totalStakingAmount >= selectedPropose.minimumStakingAmount, "Governance: Insufficient minimum staking amount");

        // If multipleVote is false, user cannot vote for multiple options.
        if ( !selectedPropose.multipleVote ) {
            require (voteOptionsLength <= 1, "Governance: No Single votes.");
        }

        // Users who vote for the first time have their address recorded in _proposalVoters.
        // And _proposalVoterNumver is incremented to calculate the number of unique users per proposal.
        // second votes not counted.
        if (_latestVoteOfUserOnProposal[ipfsHash][msg.sender].day == 0) {
            _proposalVoters[ipfsHash].push(msg.sender);
            _proposalVoterNumver[ipfsHash]++;
        }

        // Vote method only records the most recent vote history for tally(tallyNumberOfVotesOnProposal).
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

    /**
     * @notice Return day or endVotingDay.
     * @notice Returns the value of today if today is before endVotingDay.
     * @notice Otherwise, return the value of endVotingDay.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   day of execute tally.
     */
    function _getDay(bytes32 ipfsHash, uint day) internal view returns(uint) {
        Proposal memory selectedPropose = _findPropose(ipfsHash);
        uint endVotingDay = selectedPropose.endVotingDay;

        if (day < endVotingDay){
          return day;
        }

        return endVotingDay;
    }

    /**
     * @notice Calculate the number of users to tally.
     * @notice Example: Returns 10 when the number of not tallied users is 10 and amountVotesToTally is 20.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param quantity              Amount Votes To Tally.
     * @param day                   Day of execute tally.
     */
    function _getRecordCount(bytes32 ipfsHash, uint quantity, uint day) internal view returns(uint) {
        uint recordCount = quantity;
        uint index = finalizedProposalCurrentBatchIndex[ipfsHash][day];
        uint unfinalizedVotersCount = _proposalVoterNumver[ipfsHash] - index;

        if ( quantity > unfinalizedVotersCount ) {
            recordCount = unfinalizedVotersCount;
        }

        return recordCount;
    }

    /**
     * @notice Calculate voting amounts.
     * @notice Add votingAmountPerOption for amount of each option.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   Day of execute tally.
     * @param voteOptions           Options of voting.
     * @param votingAmountPerOption Amount of voting per option.
     */
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

    /**
     * @notice Calculate blank voting amount.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   Day of execute tally.
     * @param blankVotingAmount     Amount of staking for blank voting.
     */
    function _calcBlankVotingAmount(
        bytes32 ipfsHash,
        uint day,
        uint256 blankVotingAmount
    ) internal {
        _tallyStatus[ipfsHash][day].blankVotingAmount += blankVotingAmount;
    }

    /**
     * @notice set zero to voting amount for options.
     * @notice Executed at the first tally.
     *
     * @param ipfsHash              Hash value of ipfs.
     * @param day                   Day of execute tally.
     * @param optionNumber          Number of proposal's option number.
     */
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
     * @notice Method: tally number of votes on proposal.
     * @notice
     * @notice Spec:
     * @notice   - Encourage voting by displaying the voting status to users during the voting period.
     * @notice   - Allows tallying of votes even before proposals are closed.
     * @notice   - tallyNumberOfVotesOnProposal tally the date of the proposal end date(endVotingDay) when talling after the proposal end date.
     * @notice   - If tally is completed within a day, tally processing will not be performed again.
     * @notice   - Tallied for the number of users of the value of amountVotesToTally.
     * @notice   - "Tally" event emit when tally is done. And "TallyComplete" event emit when tally is completed.
     * @notice
     * @notice Others:
     * @notice   - After executing tallyNumberOfVotesOnProposal, check the tally result with getTallyStatus.
     * @notice   - BlankVotingRate is included in the tally results(TallyStatus), and you can check the ratio of blank votes.
     * @notice   - If the ratio of blank votes exceeds the predetermined threshold, the proposal will be rejected.
     * @notice   - When a user votes for an option, tally the number of votes for each option.
     * @notice   - When a user votes blank voting, the ratio of blank votes(blankVotingRate) is tallied and proposal is checked if it is valid.
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
        // Return the day to tally(day or endVotingDay).
        uint tallyDay = _getDay(ipfsHash, today);
        // Tally is not executed once all users have been tallied.
        require(_tallyStatus[ipfsHash][tallyDay].completed == false, "Tally number of votes on proposal has already finished");

        Proposal memory selectedPropose = _findPropose(ipfsHash);

        uint recordCount = _getRecordCount(ipfsHash, amountVotesToTally, tallyDay);

        // When tally is executed for the first time, we will initially set the amount of options to 0.
        // finalizedProposalCurrentBatchIndex is the index of the user whose tally has been completed.
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
            // Get the staking amount at the time of tally.
            uint256 stakingAmount = getVotingPowerOfDay(tallyDay, voterAddress);

            // If staking amount(stakingAmount) is less than minimumStakingAmount, skip tally.
            // The staking amount must be greater than or equal to the minimum staking amount specified in the proposal.
            if (stakingAmount < selectedPropose.minimumStakingAmount) continue;

            VotingHistory memory votingHistory = _latestVoteOfUserOnProposal[ipfsHash][voterAddress];
            uint[] memory voteOptions = votingHistory.voteOptions;
            uint256 stakingAmountPerOption = _calcVotingAmountPerOption(
                stakingAmount,
                voteOptions
            );

            // If there are voted options, calculate the number of votes with _calcVotingAmounts,
            // otherwise calculate the number of blank votes with _calcBlankVotingAmount
            if (voteOptions.length > 0) {
                _calcVotingAmounts(
                    ipfsHash,
                    tallyDay,
                    voteOptions,
                    stakingAmountPerOption
                );
            } else {
                // If the user votes without selecting anything(voteOptions.length is 0), it will be a blank vote.
                // A blank vote is when a voter intentionally does not choose any option in vote, leaving the vote blank.
                // If the proportion of blank votes exceeds the predetermined threshold, the proposal will be rejected.
                // Example:
                //   There is proposal that is valid if the percentage of blank votes is 30% or less.
                //   3 users are voting on the proposal.
                //   2 users voted blank voting.
                //     User A(200 FNCT*): Select [1, 2]
                //     User B(100 FNCT*): Select []
                //     User C(100 FNCT*): Select []
                //   50% of the total votes are blank votes, so the proposal is invalid.
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

        // If _proposalVoterNumver and finalizedProposalCurrentBatchIndex are equal, consider tally is completed.
        if (finalizedProposalCurrentBatchIndex[ipfsHash][tallyDay] == _proposalVoterNumver[ipfsHash]) {
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
        uint dayOfStatus = _getDay(ipfsHash, day);
        return _tallyStatus[ipfsHash][dayOfStatus];
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
