// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../fixed_interfaces/IFixedReward.sol";

/**
 * @dev Interface of the Reward.
 */
interface IReward is IFixedReward {
    struct StakingRewardRecord {
        uint date;
        uint256 amount;
        uint256 locked;
        address validator;
    }

    struct StakingCommissionRecord {
        uint date;
        uint256 amount;
        address validator;
    }

    struct CTHRewardRecord {
        uint date;
        uint256 amount;
    }

    struct PoolChangeRecord {
        uint date;
        int256 increment;
    }

    struct StakingRewardTransferTicket {
        address receiver;
        uint256 amount;
        address ticketSigner;
        bytes metaSignature;
        bytes bodySignature;
    }

    struct CTHRewardTransferTicket {
        address receiver;
        uint256 accumulatedAmount;
        address ticketSigner;
        bytes metaSignature;
        bytes bodySignature;
    }

    struct RewardTransferTickets {
        StakingRewardTransferTicket ticketForStaking;
        CTHRewardTransferTicket ticketForCTH;
    }

    struct ValidationHistory {
        uint validationDate;
        bool isJoined;
        bool isValid;
        bool isElected;
        uint rewardAmount;
    }

    // view functions

    /**
     * @dev Returns `user`'s staking reward receipts.
     */
    function getStakingRewardData(address user) external view returns(StakingRewardRecord[] memory);

    /**
     * @dev Returns `user`'s staking commission receipts.
     */
    function getStakingCommissionData(address user) external view returns(StakingCommissionRecord[] memory);

    /**
     * @dev Returns the staking pool size of the `day`.
     * @note `day` is days since launch date
     */
    function getStakingPoolSize(uint day) external view returns(uint256);

    /**
     * @dev Returns current CTH pool size.
     */
    function getCTHPoolSize() external view returns(uint256);

    /**
     * @dev Returns the staking reward amount of the `daysAfterLaunch`.
     */
    function getDailyStakingRewardsAmount(uint daysAfterLaunch) external view returns(uint256);

    /**
     * @dev Returns available staking reward amount of the `user`.
     */
    function calcAvailableStakingRewardAmount(address user) external view returns(uint256);

    /**
     * @dev Returns available staking commission amount of the `user`.
     */
    function calcAvailableStakingCommissionAmount(address user) external view returns(uint256);

    /**
     * @dev Returns staking reward receipts of the `user` from `startDate` up to `nRecords`.
     * @note `startDate` is a date since launch
     */
    function getStakingRewardAccrualHistory(address user, uint startDate, uint nRecords) external view returns(StakingRewardRecord[] memory);

    /**
     * @dev Returns staking commission receipts of the `user` from `startDate` up to `nRecords`.
     * @note `startDate` is a date since launch
     */
    function getStakingCommissionAccrualHistory(address user, uint startDate, uint nRecords) external view returns(StakingCommissionRecord[] memory);

    /**
     * @dev Returns the validation history of the `validator` from `startDate` up to `nRecords`.
     * @note `startDate` is a date since launch
     */
    function getValidationHistory(address validator, uint startDate, uint nRecords) external view returns(ValidationHistory[] memory);

    /**
     * @dev Returns total received staking reward amount of the `user`.
     */
    function getReceivedStakingRewardAmount(address user) external view returns(uint256);

    /**
     * @dev Returns total received staking commission amount of the `user`.
     */
    function getReceivedStakingCommissionAmount(address user) external view returns(uint256);

    /**
     * @dev Returns total received CTH reward amount of the `user`.
     */
    function getReceivedCTHRewardAmount(address user) external view returns(uint256);

    // operator management

    /**
     * @dev Sets ticket signer for meta transactions to the `signer`.
     */
    function setTicketSigner(address signer) external;

    // pool management

    /**
     * @dev Moves `amount` tokens from the caller and schedule to expand staking reward pool size on the `startDay`.
     * @note Requires `amount` of tokens should be approved from the caller to this contract
     * @note `startDay` is days since launch date
     */
    function supplyStakingPool(uint startDay, uint256 amount) external;

    /**
     * @dev Recycles staking reward pool tokens allocated on `targetDay` and schedules to reallocate the tokens on the `startDay`.
     * @note Requires that no winner was chosen for `targetDay` immutably
     * @note `startDay` and `targetDay` are days since launch date
     */
    function recycleStakingPool(uint startDay, uint targetDay) external;

    /**
     * @dev Moves `amount` tokens from the caller and expand CTH pool size immediately.
     * @note Requires `amount` of tokens should be approved from the caller to this contract
     * @note `startDay` is days since launch date
     */
    function supplyCTHPool(uint256 amount) external;

    // self Txs

    /**
     * @dev Moves staking reward tokens from this contract to the caller and returns received token amount.
     * @note Receives multiple days reward at once up to the gasLimit
     */
    function claimStakingReward() external returns(uint256);

    /**
     * @dev Moves CTH reward tokens from this contract to the `ticket`.receiver and returns received token amount.
     */
    function claimCTHReward(CTHRewardTransferTicket calldata ticket) external returns(uint256);

    /**
     * @dev Moves staking and CTH reward tokens from this contract to the `ticket`.receiver and returns received token amount.
     */
    function claimRewards(CTHRewardTransferTicket calldata ticket) external returns(uint256);

    /**
     * @dev Moves staking commission tokens of the `validator` from this contract to the caller and returns received token amount.
     * @note Receives multiple days reward at once up to the gasLimit
     */
    function claimStakingCommission(address validator) external returns(uint256);

    // meta Txs

    /**
     * @dev Meta transaction for claimStakingReward with signed `ticket`
     */
    function metaClaimStakingReward(StakingRewardTransferTicket calldata ticket) external returns(uint256);

    /**
     * @dev Meta transaction for claimCTHReward with signed `ticket`
     */
    function metaClaimCTHReward(CTHRewardTransferTicket calldata ticket) external returns(uint256);

    /**
     * @dev Meta transaction for claimRewards with signed `tickets`
     */
    function metaClaimRewards(RewardTransferTickets calldata tickets) external returns(uint256);

    /**
     * @dev Meta transaction of claimRewards for multiple users with signed `tickets` and returns total received token amount.
     */
    function metaClaimRewardsWithList(RewardTransferTickets[] calldata tickets) external returns(uint256);

    // Events

    /**
     * @dev Emitted when `amount` of staking reward supply scheduled for `daysAfterLaunch` with `newBasePool` amount
     * @note `daysAfterLaunch` is days since launch date
     */
    event StakingTokenSupplyScheduled(uint daysAfterLaunch, uint256 amount, uint newBasePool);

    /**
     * @dev Emitted when staking reward tokens allocated for `targetDay` are recycled back into the base pool.
     *      This recycling could happen if no winner was chosen for `targetDay`, and thus no rewards were given.
     *      `amount` is re-added back to the base pool on `daysAfterLaunch`, and new base pool value is `newBasePool`
     * @note `daysAfterLaunch` and `targetDay` are days since launch date
     */
    event StakingTokenSupplyRecycled(uint daysAfterLaunch, uint targetDay, uint256 amount, uint newBasePool);

    /**
     * @dev Emitted when `amount` of CTH reward supply scheduled
     * @note supplied immediately
     */
    event CTHTokenSupplied(uint256 amount);

    /**
     * @dev Emitted when `amount` of staking reward moved from the contract to `receiver` called by a `sender`
     * @note accumulated: accumulated amount of transferred for the `sender`
     */
    event TransferredStakingReward(address indexed sender, address indexed receiver, uint256 amount, uint256 accumulated);

    /**
     * @dev Emitted when `amount` of staking commission moved from the contract to `receiver` for the `validator`
     * @note accumulated: accumulated amount of transferred for the `validator`
     */
    event TransferredStakingCommission(address indexed validator, address indexed receiver, uint256 amount, uint256 accumulated);

    /**
     * @dev Emitted when `amount` of CTH reward moved from the contract to `receiver` called by a `sender`
     * @note accumulated: accumulated amount of transferred for the `sender`
     */
    event TransferredCTHReward(address indexed sender, address indexed receiver, uint256 amount, uint256 accumulated);

    /**
     * @dev Emitted when `amount` of rewards moved from the contract to `receiver` called by a `sender`
     */
    event TransferredRewards(address indexed sender, address indexed receiver, uint256 amount);
}
