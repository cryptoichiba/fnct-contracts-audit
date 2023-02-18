// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/ITime.sol";
import "./interfaces/IReward.sol";
import "./interfaces/IStaking.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/IVault.sol";
import "./interfaces/ILogFileHash.sol";
import "./utils/TicketUtils.sol";
import "./utils/UnrenounceableOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RewardContract is IReward, UnrenounceableOwnable, TicketUtils {
    ITime private immutable _timeContract;
    IERC20 private immutable _token;
    IStaking private immutable _stakingContract;
    IValidator private immutable _validatorContract;
    IVault private immutable _vaultContract;
    ILogFileHash private immutable _logFileHash;

    mapping(address => StakingRewardRecord[]) _stakingRewardReceipts;
    mapping(address => StakingCommissionRecord[]) _stakingCommissionReceipts;
    mapping(address => CTHRewardRecord[]) _cthRewardReceipts;

    uint constant _dailyAllocationFromPoolPPM = 1708;   // 0.1708%
    uint constant _denominatorInPPM = 10 ** 6;          // 100%

    struct ScheduledRewards {
        uint availableDaysAfterLaunch;
        uint256 amount;
    }

    ScheduledRewards[] _scheduledRewards;
    mapping(address => mapping(uint => bool)) _receivedStakingRewards;
    mapping(address => mapping(uint => bool)) _receivedStakingCommission;
    mapping(address => uint) _willReceiveFrom;
    mapping(address => uint) _willReceiveCommissionFrom;
    mapping(address => uint256) _receivedStakingRewardAmounts;
    mapping(address => uint256) _receivedStakingCommissionAmounts;
    mapping(bytes32 => bool) _usedBodySignatureHash;

    mapping(uint => bool) _stakingRewardRecycled;

    uint256 _cthPoolSize = 0;
    address _ticketSigner;

    modifier isValidStakingRewardTicket(StakingRewardTransferTicket calldata ticket) {
        if ( ticket.receiver != address(0) ) {
            address headSigner;
            address bodySigner;
            (headSigner, bodySigner) = _recoverSigners(
                ticket.receiver,
                ticket.ticketSigner,
                ticket.amount,
                ticket.metaSignature,
                ticket.bodySignature
            );
            require(!_usedBodySignatureHash[keccak256(ticket.bodySignature)], "Reward: Ticket had been already used");
            require(bodySigner == ticket.ticketSigner, "Reward: Invalid body signer");
            require(headSigner == _ticketSigner, "Reward: Invalid head signer");
        }
        _;
    }

    modifier isValidCTHRewardTicket(CTHRewardTransferTicket calldata ticket) {
        if ( ticket.receiver != address(0) ) {
            address headSigner;
            address bodySigner;
            (headSigner, bodySigner) = _recoverSigners(
                ticket.receiver,
                ticket.ticketSigner,
                ticket.accumulatedAmount,
                ticket.metaSignature,
                ticket.bodySignature
            );
            require(!_usedBodySignatureHash[keccak256(ticket.bodySignature)], "Reward: Ticket had been already used");
            require(bodySigner == ticket.ticketSigner, "Reward: Invalid body signer");
            require(headSigner == _ticketSigner, "Reward: Invalid head signer");
        }
        _;
    }

    /**
     * @notice Constructor
     *
     * @param timeContract_         Address of Time contract
     * @param fnct_                 Address of FNCT contract
     * @param stakingContract_      Address of StakingContract
     * @param validatorContract_    Address of ValidatorContract
     * @param vaultContract_        Address of VaultContract
     * @param logFileHash_          Address of LogFileHash contract
     */
    constructor(address timeContract_, address fnct_, address stakingContract_, address validatorContract_, address vaultContract_, address logFileHash_) {
        require(timeContract_ != address(0x0), "Reward: TimeContract is zero address");
        require(fnct_ != address(0x0), "Reward: FNCT is zero address");
        require(stakingContract_ != address(0x0), "Reward: StakingContract is zero address");
        require(validatorContract_ != address(0x0), "Reward: ValidatorContract is zero address");
        require(vaultContract_ != address(0x0), "Reward: VaultContract is zero address");
        require(logFileHash_ != address(0x0), "Reward: LogFileHash is zero address");

        _timeContract = ITime(timeContract_);
        _token = IERC20(fnct_);
        _stakingContract = IStaking(payable(stakingContract_));
        _validatorContract = IValidator(validatorContract_);
        _vaultContract = IVault(vaultContract_);
        _logFileHash = ILogFileHash(logFileHash_);

        _ticketSigner = owner();
    }

    /**
     * Returns base pool size of the daysAfterLaunch
     */
    function _getBasePool(uint daysAfterLaunch) internal view returns(ScheduledRewards memory) {
        for ( uint i = 0; i < _scheduledRewards.length; i++ ) {
            uint index = _scheduledRewards.length - i - 1;
            if ( _scheduledRewards[index].availableDaysAfterLaunch <= daysAfterLaunch ) {
                return _scheduledRewards[index];
            }
        }

        // No scheduled pool
        return ScheduledRewards(0, 0);
    }

    /**
     * @dev Returns the staking pool size of the `day`.
     * @note `day` is days since launch date
     * Example;
     * Base Pool of Day1 = 100, daily allocation = 5%
     *   Day0: 0
     *   Day1: 100
     *   Day2: 100 * 95% = 95
     *   Day3: 95 * 95% = 90.25
     *   Day4: 90.25 * 95% = 85.7375
     */
    function getStakingPoolSize(uint daysAfterLaunch) override public view returns(uint256) {
        ScheduledRewards memory basePool = _getBasePool(daysAfterLaunch);
        uint256 amount = basePool.amount;
        for ( uint day = 0; day < daysAfterLaunch - basePool.availableDaysAfterLaunch; day++ ) {
            amount -= amount * _dailyAllocationFromPoolPPM / _denominatorInPPM;
            if ( amount == 0 ) break;
        }
        return amount;
    }

    /**
     * @dev Returns current CTH pool size.
     */
    function getCTHPoolSize() override external view returns(uint256) {
        return _cthPoolSize;
    }

    /**
     * @dev Returns the staking reward amount of the `daysAfterLaunch`.
     * Example;
     * Base Pool of Day1 = 100, daily allocation = 5%
     *   Day0: 0
     *   Day1: 100 * 5% = 5
     *   Day3: 95 * 5% = 4.5125
     */
    function getDailyStakingRewardsAmount(uint daysAfterLaunch) override public view returns(uint256) {
        uint256 pool = getStakingPoolSize(daysAfterLaunch);
        return pool * _dailyAllocationFromPoolPPM / _denominatorInPPM;
    }

    /**
     * @dev Returns `user`'s staking reward receipts.
     */
    function getStakingRewardData(address user) override external view returns(StakingRewardRecord[] memory) {
        return _stakingRewardReceipts[user];
    }

    /**
     * @dev Returns `user`'s staking commission receipts.
     */
    function getStakingCommissionData(address user) override external view returns(StakingCommissionRecord[] memory) {
        return _stakingCommissionReceipts[user];
    }

    /// operator management

    /**
     * @dev Sets ticket signer for meta transactions to the `signer`.
     */
    function setTicketSigner(address signer) override external onlyOwner {
        require(signer != address(0x0), "Reward: Signer is zero address");
        _ticketSigner = signer;
    }

    /// pool management

    /**
     * @dev Moves `amount` tokens from the caller and schedule to expand staking reward pool size on the `startDay`.
     * @note Requires `amount` of tokens should be approved from the caller to this contract
     * @note `startDay` is days since launch date
     */
    function supplyStakingPool(uint startDay, uint256 amount) override external onlyOwner {
        require(amount > 0, "Reward: Amount is zero");
        require(startDay >= _timeContract.getCurrentTimeIndex(), "Reward: You can't specify day in the past");

        uint256 newBasePool = _supplyStakingPool(startDay, amount);

        SafeERC20.safeTransferFrom(_token, msg.sender, address(this), amount);

        emit StakingTokenSupplyScheduled(startDay, amount, newBasePool);
    }

    /**
     * @dev Recycles staking reward pool tokens allocated on `targetDay` and schedules to reallocate the tokens on the `startDay`.
     * @note Requires that no winner was chosen for `targetDay` immutably
     * @note `startDay` and `targetDay` are days since launch date
     */
    function recycleStakingPool(uint startDay, uint targetDay) override external onlyOwner {
        require(targetDay > 0, "Reward: You can't specify day in the past");
        require(targetDay < _timeContract.getCurrentTimeIndex(), "Reward: You can't specify future date");
        require(!_stakingRewardRecycled[targetDay], "Reward: Already recycled");

        address winner;
        WinnerStatus status;
        (winner, status) = _logFileHash.getWinner(targetDay);
        require(status == WinnerStatus.NoMajority || status == WinnerStatus.Abandoned, "Reward: Winner status should be NoMajority or Abandoned");

        uint256 amount = getDailyStakingRewardsAmount(targetDay);
        uint256 newBasePool = _supplyStakingPool(startDay, amount);

        _stakingRewardRecycled[targetDay] = true;

        emit StakingTokenSupplyRecycled(startDay, targetDay, amount, newBasePool);
    }

    function _supplyStakingPool(uint startDay, uint amount) internal returns(uint256) {
        require(startDay > 0, "Reward: You can't specify day in the past");
        require(startDay >= _timeContract.getCurrentTimeIndex(), "Reward: You can't specify day in the past");
        require(
            _scheduledRewards.length == 0 ||
            _scheduledRewards[_scheduledRewards.length - 1].availableDaysAfterLaunch < startDay,
            "Reward: Already scheduled after specified day"
        );

        // Calclate new pool size:
        uint256 newBasePool = getStakingPoolSize(startDay) + amount;
        _scheduledRewards.push(ScheduledRewards(startDay, newBasePool));
        return newBasePool;
    }

    /**
     * @dev Moves `amount` tokens from the caller and expand CTH pool size immediately.
     * @note Requires `amount` of tokens should be approved from the caller to this contract
     * @note `startDay` is days since launch date
     */
    function supplyCTHPool(uint256 amount) override external onlyOwner {
        _cthPoolSize += amount;

        SafeERC20.safeTransferFrom(_token, msg.sender, address(this), amount);

        emit CTHTokenSupplied(amount);
    }

    /**
     * @dev Returns available staking reward amount of the `user`.
     */
    function calcAvailableStakingRewardAmount(address user) override external view returns(uint256) {
        uint256 total = 0;
        uint today = _timeContract.getCurrentTimeIndex();
        for ( uint day = 0; day < today; day++ ) {
            if ( !_receivedStakingRewards[user][day] ) {
                StakingRewardRecord memory rewardRecord;
                WinnerStatus status;
                (rewardRecord, status) = _calcAvailableStakingRewardAmountOfDay(day, user);
                if ( status == WinnerStatus.Decided ) {
                    total += rewardRecord.amount;
                }
            }
        }
        return total;
    }

    /**
     * @dev Returns available staking commission amount of the `user`.
     */
    function calcAvailableStakingCommissionAmount(address user) override external view returns(uint256) {
        uint256 total = 0;
        uint today = _timeContract.getCurrentTimeIndex();
        for ( uint day = 0; day < today; day++ ) {
            if ( !_receivedStakingCommission[user][day] ) {
                StakingCommissionRecord memory commissionRecord;
                WinnerStatus status;
                (commissionRecord, status) = _calcAvailableStakingCommissionAmountOfDay(day, user);
                if ( status == WinnerStatus.Decided ) {
                    total += commissionRecord.amount;
                }
            }
        }
        return total;
    }

    function _calcAvailableStakingRewardAmountOfDay(uint day, address user) internal view returns(StakingRewardRecord memory, WinnerStatus) {
        address chosenValidator = _stakingContract.getValidatorOfDay(day, user);
        address winner;
        WinnerStatus status;
        (winner, status) = _logFileHash.getWinner(day);

        if ( status == WinnerStatus.Decided && chosenValidator == winner ) {
            uint commission = _validatorContract.getCommissionRateOfDay(day, chosenValidator);
            uint256 locked = _vaultContract.calcLockOfDay(day, user);
            if ( locked == 0 ) {
                // user did not have available lock
                return (StakingRewardRecord(day, 0, 0, address(0x0)), status);
            }

            uint256 delegated = _stakingContract.getTotalDelegatedTo(day, chosenValidator);
            uint256 grossRewards = delegated == 0 ? 0 : getDailyStakingRewardsAmount(day) * locked / delegated;
            uint256 reward = (grossRewards * (_denominatorInPPM - commission)) / _denominatorInPPM;
            return (StakingRewardRecord(day, reward, locked, chosenValidator), status);
        }

        return (StakingRewardRecord(day, 0, 0, address(0x0)), status);
    }

    function _calcAvailableStakingCommissionAmountOfDay(uint day, address validator) internal view returns(StakingCommissionRecord memory, WinnerStatus) {
        address winner;
        WinnerStatus status;
        (winner, status) = _logFileHash.getWinner(day);
        if ( status == WinnerStatus.Decided && validator == winner ) {
            uint commissionRate = _validatorContract.getCommissionRateOfDay(day, validator);
            uint256 grossRewards = getDailyStakingRewardsAmount(day);
            uint256 commission = (grossRewards * commissionRate) / _denominatorInPPM;
            return (StakingCommissionRecord(day, commission, validator), status);
        }

        return (StakingCommissionRecord(day, 0, address(0x0)), status);
    }

    /**
     * @dev Returns staking reward receipts of the `user` from `startDate` up to `nRecords`.
     * @note `startDate` is a date since launch
     */
    function getStakingRewardAccrualHistory(
        address user, uint startDate, uint nRecords
    ) override external view returns(StakingRewardRecord[] memory) {
        StakingRewardRecord[] memory temporary = new StakingRewardRecord[](nRecords);
        uint recordCount = 0;

        for ( uint day = startDate; day >= 0 && recordCount < nRecords; day-- ) {
            StakingRewardRecord memory rewardRecord;
            WinnerStatus status;
            (rewardRecord, status) = _calcAvailableStakingRewardAmountOfDay(day, user);
            if ( rewardRecord.amount > 0 ) {
                temporary[recordCount] = rewardRecord;
                recordCount++;
            }

            if ( day == 0 ) {
                break;
            }
        }

        StakingRewardRecord[] memory output = new StakingRewardRecord[](recordCount);
        for ( uint i = 0; i < recordCount; i++ ) {
            output[i] = temporary[i];
        }

        return output;
    }

    /**
     * @dev Returns staking commission receipts of the `user` from `startDate` up to `nRecords`.
     * @note `startDate` is a date since launch
     */
    function getStakingCommissionAccrualHistory(
        address user, uint startDate, uint nRecords
    ) override external view returns(StakingCommissionRecord[] memory) {
        StakingCommissionRecord[] memory temporary = new StakingCommissionRecord[](nRecords);
        uint recordCount = 0;

        for ( uint day = startDate; day >= 0 && recordCount < nRecords; day-- ) {
            StakingCommissionRecord memory commissionRecord;
            WinnerStatus status;
            (commissionRecord, status) = _calcAvailableStakingCommissionAmountOfDay(day, user);
            if ( commissionRecord.amount > 0 ) {
                temporary[recordCount] = commissionRecord;
                recordCount++;
            }

            if ( day == 0 ) {
                break;
            }
        }

        StakingCommissionRecord[] memory output = new StakingCommissionRecord[](recordCount);
        for ( uint i = 0; i < recordCount; i++ ) {
            output[i] = temporary[i];
        }

        return output;
    }

    /**
     * @dev Returns the validation history of the `validator` from `startDate` up to `nRecords`.
     * @note `startDate` is a date since launch
     */
    function getValidationHistory(
        address validator, uint startDay, uint nRecords
    ) override external view returns(ValidationHistory[] memory) {
        ValidationHistory[] memory temporary = new ValidationHistory[](nRecords);
        uint recordCount = 0;

        for ( uint day = startDay; day >= 0 && recordCount < nRecords; day-- ) {
            address[] memory participatedValidators = _logFileHash.getParticipatedValidators(day);
            address[] memory majorityValidators = _logFileHash.getMajorityValidators(day);
            bool participated = false;
            bool majority = false;

            if ( _include(participatedValidators, validator) ) {
                participated = true;
            }

            if ( _include(majorityValidators, validator) ) {
                majority = true;
            }

            bool win;
            uint256 reward;
            address winner;
            WinnerStatus status;
            (winner, status) = _logFileHash.getWinner(day);
            if ( status == WinnerStatus.Decided && validator == winner ) {
                win = true;
                reward = getDailyStakingRewardsAmount(day);
            } else {
                win = false;
                reward = 0;
            }

            temporary[recordCount] = ValidationHistory(day, participated, majority, win, reward);
            recordCount++;

            if ( day == 0 ) {
                break;
            }
        }

        ValidationHistory[] memory output = new ValidationHistory[](recordCount);
        for (uint i = 0; i < recordCount; i++) {
            output[i] = temporary[i];
        }

        return output;
    }

    function _include(address[] memory array, address element) internal pure returns(bool) {
        for ( uint i = 0; i < array.length; i++ ) {
            if (element == array[i]) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Returns total received staking reward amount of the `user`.
     */
    function getReceivedStakingRewardAmount(address user) override external view returns (uint256) {
        uint256 output = 0;
        for (uint i = 0; i < _stakingRewardReceipts[user].length; i++) {
            output += _stakingRewardReceipts[user][i].amount;
        }
        return output;
    }

    /**
     * @dev Returns total received staking commission amount of the `user`.
     */
    function getReceivedStakingCommissionAmount(address user) override external view returns (uint256) {
        uint256 output = 0;
        for (uint i = 0; i < _stakingCommissionReceipts[user].length; i++) {
            output += _stakingCommissionReceipts[user][i].amount;
        }
        return output;
    }

    /**
     * @dev Returns total received CTH reward amount of the `user`.
     */
    function getReceivedCTHRewardAmount(address user) override public view returns (uint256) {
        uint256 output = 0;
        for (uint i = 0; i < _cthRewardReceipts[user].length; i++) {
            output += _cthRewardReceipts[user][i].amount;
        }
        return output;
    }

    /// self Txs

    /**
     * @dev Moves staking reward tokens from this contract to the caller and returns received token amount.
     * @note Receives multiple days reward at once up to the gasLimit
     */
    function claimStakingReward() override external returns(uint256) {
        return _transferStakingReward(msg.sender);
    }

    /**
     * @dev Moves staking commission tokens of the `validator` from this contract to the caller and returns received token amount.
     * @note Receives multiple days reward at once up to the gasLimit
     */
    function claimStakingCommission(address validator) external returns(uint256) {
        require(_validatorContract.checkIfExist(validator), "Reward: Validator is not in the whitelist");
        require(_validatorContract.getCommissionReceiver(validator) == msg.sender, "Reward: Sender is not allowed as a receiver");
        return _transferStakingCommission(validator, msg.sender);
    }

    /**
     * @dev Moves CTH reward tokens from this contract to the `ticket`.receiver and returns received token amount.
     */
    function claimCTHReward(CTHRewardTransferTicket calldata ticket) 
        isValidCTHRewardTicket(ticket)
        override external returns(uint256) {
        _usedBodySignatureHash[keccak256(ticket.bodySignature)] = true;
        return _transferCTHReward(ticket.receiver, ticket.accumulatedAmount);
    }

    /**
     * @dev Moves staking and CTH reward tokens from this contract to the `ticket`.receiver and returns received token amount.
     */
    function claimRewards(CTHRewardTransferTicket calldata ticket)
        isValidCTHRewardTicket(ticket)
        override external returns(uint256) {
        _usedBodySignatureHash[keccak256(ticket.bodySignature)] = true;
        uint256 transferredAmount = _transferStakingReward(msg.sender) + _transferCTHReward(ticket.receiver, ticket.accumulatedAmount);

        emit TransferredRewards(msg.sender, msg.sender, transferredAmount);

        return transferredAmount;
    }

    /// meta Txs

    /**
     * @dev Meta transaction for claimStakingReward with signed `ticket`
     */
    function metaClaimStakingReward(StakingRewardTransferTicket calldata ticket)
        isValidStakingRewardTicket(ticket)
        override external returns(uint256) {
        _usedBodySignatureHash[keccak256(ticket.bodySignature)] = true;
        return _transferStakingReward(ticket.receiver);
    }

    /**
     * @dev Meta transaction for claimCTHReward with signed `ticket`
     */
    function metaClaimCTHReward(CTHRewardTransferTicket calldata ticket)
        isValidCTHRewardTicket(ticket)
        override external returns(uint256) {
        _usedBodySignatureHash[keccak256(ticket.bodySignature)] = true;
        return _transferCTHReward(ticket.receiver, ticket.accumulatedAmount);
    }

    /**
     * @dev Meta transaction for claimRewards with signed `tickets`
     */
    function metaClaimRewards(RewardTransferTickets calldata tickets) override external returns(uint256) {
        return _transferRewards(tickets);
    }

    /**
     * @dev Meta transaction of claimRewards for multiple users with signed `tickets` and returns total received token amount.
     */
    function metaClaimRewardsWithList(RewardTransferTickets[] calldata ticketsList) override external returns(uint256) {
        uint256 transferredAmount = 0;
        for ( uint i = 0; i < ticketsList.length; i++ ) {
            transferredAmount += _transferRewards(ticketsList[i]);
        }
        return transferredAmount;
    }

    /// private functions

    function _transferStakingReward(address receiver) internal returns(uint256) {
        if ( receiver == address(0) ) {
          return 0;
        }
        uint today = _timeContract.getCurrentTimeIndex();
        uint256 locked = _vaultContract.calcLock(receiver);
        address validator = _stakingContract.getValidatorOfDay(today, receiver);

        uint256 availableReward = 0;
        uint gasRequirement = 1_000_000;
        for ( uint day = _willReceiveFrom[receiver]; day < today && gasRequirement < gasleft(); day++ ) {
            if ( !_receivedStakingRewards[receiver][day] ) {
                StakingRewardRecord memory rewardRecord;
                WinnerStatus status;
                (rewardRecord, status) = _calcAvailableStakingRewardAmountOfDay(day, receiver);
                if ( status == WinnerStatus.Decided || status == WinnerStatus.NoMajority || status == WinnerStatus.Abandoned ) {
                    // For other reason, they might be granted rewards later
                    availableReward += rewardRecord.amount;
                    _receivedStakingRewards[receiver][day] = true;
                    if ( _willReceiveFrom[receiver] == day ) {
                        // Received continuously. Will start from next day on the next time.
                        _willReceiveFrom[receiver]++;
                    }
                }
            }
        }

        _stakingRewardReceipts[receiver].push(StakingRewardRecord(today, availableReward, locked, validator));
        _receivedStakingRewardAmounts[receiver] += availableReward;

        SafeERC20.safeTransfer(_token, receiver, availableReward);

        emit TransferredStakingReward(msg.sender, receiver, availableReward, _receivedStakingRewardAmounts[receiver]);

        return availableReward;
    }

    function _transferStakingCommission(address validator, address receiver) internal returns(uint256) {
        uint today = _timeContract.getCurrentTimeIndex();
        uint256 availableCommission = 0;
        uint gasRequirement = 1_000_000;
        for ( uint day = _willReceiveCommissionFrom[validator]; day < today && gasRequirement < gasleft(); day++ ) {
            if ( !_receivedStakingCommission[validator][day] ) {
                StakingCommissionRecord memory commissionRecord;
                WinnerStatus status;
                (commissionRecord, status) = _calcAvailableStakingCommissionAmountOfDay(day, validator);
                if ( status == WinnerStatus.Decided || status == WinnerStatus.NoMajority || status == WinnerStatus.Abandoned ) {
                    // For other reason, they might be granted comission later
                    availableCommission += commissionRecord.amount;
                    _receivedStakingCommission[validator][day] = true;
                    if ( _willReceiveCommissionFrom[validator] == day ) {
                        // Received continuously. Will start from next day on the next time.
                        _willReceiveCommissionFrom[validator]++;
                    }
                }
            }
        }

        _stakingCommissionReceipts[validator].push(StakingCommissionRecord(today, availableCommission, validator));
        _receivedStakingCommissionAmounts[validator] += availableCommission;

        SafeERC20.safeTransfer(_token, receiver, availableCommission);

        emit TransferredStakingCommission(validator, receiver, availableCommission, _receivedStakingCommissionAmounts[validator]);

        return availableCommission;
    }

    function _transferCTHReward(address receiver, uint256 accumulatedAmount) internal returns(uint256) {
        if ( receiver == address(0) || accumulatedAmount == 0 ) {
            return 0;
        }

        uint today = _timeContract.getCurrentTimeIndex();
        uint256 receivedAmount = getReceivedCTHRewardAmount(receiver);
        if ( accumulatedAmount <= receivedAmount ) {
            return 0;
        }

        uint256 availableReward = accumulatedAmount - receivedAmount;
        require(availableReward <= _cthPoolSize, "Reward: Over budget of CTH rewards");

        _cthPoolSize -= availableReward;
        _cthRewardReceipts[receiver].push(CTHRewardRecord(today, availableReward));

        SafeERC20.safeTransfer(_token, receiver, availableReward);

        emit TransferredCTHReward(msg.sender, receiver, availableReward, accumulatedAmount);

        return availableReward;
    }

    function _transferRewards(RewardTransferTickets calldata tickets)
        isValidStakingRewardTicket(tickets.ticketForStaking)
        isValidCTHRewardTicket(tickets.ticketForCTH)
        internal returns(uint256) {
        require(
            tickets.ticketForStaking.receiver == tickets.ticketForCTH.receiver ||
            tickets.ticketForStaking.receiver == address(0x0) ||
            tickets.ticketForCTH.receiver == address(0x0),
            "Reward: Invalid receiver"
        );

        _usedBodySignatureHash[keccak256(tickets.ticketForStaking.bodySignature)] = true;
        _usedBodySignatureHash[keccak256(tickets.ticketForCTH.bodySignature)] = true;

        uint256 transferredAmount = _transferStakingReward(tickets.ticketForStaking.receiver)
            + _transferCTHReward(tickets.ticketForCTH.receiver, tickets.ticketForCTH.accumulatedAmount);

        address receiver = tickets.ticketForStaking.receiver != address(0x0) ?
            tickets.ticketForStaking.receiver : tickets.ticketForCTH.receiver;

        emit TransferredRewards(msg.sender, receiver, transferredAmount);

        return transferredAmount;
    }

}
