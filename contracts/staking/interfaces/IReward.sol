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
    function getStakingRewardData(address user) external view returns(StakingRewardRecord[] memory);
    function getStakingCommissionData(address user) external view returns(StakingCommissionRecord[] memory);
    function getStakingPoolSize(uint day) external view returns(uint256);
    function getCTHPoolSize() external view returns(uint256);
    function getDailyStakingRewardsAmount(uint daysAfterLaunch) external view returns(uint256);
    function calcAvailableStakingRewardAmount(address user) external view returns(uint256);
    function calcAvailableStakingCommissionAmount(address user) external view returns(uint256);
    function getStakingRewardAccrualHistory(address user, uint startDate, uint nRecords) external view returns(StakingRewardRecord[] memory);
    function getStakingCommissionAccrualHistory(address user, uint startDate, uint nRecords) external view returns(StakingCommissionRecord[] memory);
    function getValidationHistory(address validator, uint startDate, uint nRecords) external view returns(ValidationHistory[] memory);
    function getReceivedStakingRewardAmount(address user) external view returns(uint256);
    function getReceivedStakingCommissionAmount(address user) external view returns(uint256);
    function getReceivedCTHRewardAmount(address user) external view returns(uint256);

    // operator management
    function setTicketSigner(address signer) external;

    // pool management
    function supplyStakingPool(uint startDay, uint256 amount) external;
    function recycleStakingPool(uint startDay, uint targetDay) external;
    function supplyCTHPool(uint256 amount) external;

    // self Txs
    function claimStakingReward() external returns(uint256);
    function claimCTHReward(CTHRewardTransferTicket calldata ticket) external returns(uint256);
    function claimRewards(CTHRewardTransferTicket calldata ticket) external returns(uint256);

    function claimStakingCommission(address validator) external returns(uint256);

    // meta Txs
    function metaClaimStakingReward(StakingRewardTransferTicket calldata ticket) external returns(uint256);
    function metaClaimCTHReward(CTHRewardTransferTicket calldata ticket) external returns(uint256);
    function metaClaimRewards(RewardTransferTickets calldata tickets) external returns(uint256);
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
