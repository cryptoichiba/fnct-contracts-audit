// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "../interfaces/IReward.sol";
import "../interfaces/IStaking.sol";
import "../utils/TicketUtils.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockRewardContract is IReward, Ownable, TicketUtils {
    uint _launchDate;
    IStaking _stakingContract;
    mapping(address => StakingRewardRecord[]) _rewardHistory;
    mapping(address => uint) _transferHistory;
    mapping(address => uint) _cthTransferHistory;

    constructor(address stakingContract_) {
        _launchDate = block.timestamp;
        _stakingContract = IStaking(stakingContract_);
    }

    /**********************************************************************************************************
    * view functions
    **********************************************************************************************************/

    function getStakingPoolSize(uint day) override external pure returns(uint) {
        day;
        return 2234 ether;
    }

    function getCTHPoolSize() override external pure returns(uint) {
        return 3456 ether;
    }

    function getDailyStakingRewardsAmount(uint day) external pure returns(uint) {
        day;
        return 2234 ether * 5 / 100;
    }

    function calcAvailableStakingRewardAmountOfDay(uint day, address user) public view returns(StakingRewardRecord memory, WinnerStatus) {
        day; user;

        address validator = 0x0957b455E9f3B32bF75aC68d05FdEf151e192779;
        return (StakingRewardRecord(4, 31 ether, 2 ether, validator), WinnerStatus.Decided);
    }

    function calcAvailableStakingRewardAmount(address user) override external pure returns(uint) {
        user;
        return 2234 ether;
    }

    function calcAvailableStakingCommissionAmount(address user) override external pure returns(uint256){
        user;
        return 2234 ether;
    }

    function getStakingRewardAccrualHistory(
        address user, uint startDate, uint nRecords
    ) override external pure returns (StakingRewardRecord[] memory) {
        user; startDate; nRecords;

        address validator = 0x0957b455E9f3B32bF75aC68d05FdEf151e192779;
        StakingRewardRecord[] memory output = new StakingRewardRecord[](4);

        output[0] = StakingRewardRecord(4, 31 ether, 2 ether, validator);
        output[1] = StakingRewardRecord(3, 33 ether, 2 ether, validator);
        output[2] = StakingRewardRecord(2, 2242 ether, 1 ether, validator);
        output[3] = StakingRewardRecord(1, 224 ether, 2 ether, validator);

        return output;
    }
    function getStakingCommissionAccrualHistory(
        address user, uint startDate, uint nRecords
    ) override external pure returns(StakingCommissionRecord[] memory) {
        user; startDate; nRecords;

        address validator = 0x0957b455E9f3B32bF75aC68d05FdEf151e192779;
        StakingCommissionRecord[] memory output = new StakingCommissionRecord[](4);

        output[0] = StakingCommissionRecord(4, 31 ether, validator);
        output[1] = StakingCommissionRecord(3, 33 ether, validator);
        output[2] = StakingCommissionRecord(2, 2242 ether, validator);
        output[3] = StakingCommissionRecord(1, 224 ether, validator);

        return output;
    }


    function getValidationHistory(address validator, uint startDate, uint nRecords)
        override external pure returns (ValidationHistory[] memory) {
        validator; startDate; nRecords;

        ValidationHistory[] memory output = new ValidationHistory[](4);
        output[0] = ValidationHistory(4, true, true, true, 30 * 10 ** 18, 6 * 10 ** 18);
        output[1] = ValidationHistory(3, true, true, false, 10 * 10 ** 18, 2 * 10 ** 18);
        output[2] = ValidationHistory(2, true, false, false, 20 * 10 ** 18, 4 * 10 ** 18);
        output[3] = ValidationHistory(1, false, false, false, 0, 0);

        return output;
    }


    function getReceivedStakingRewardAmount(address user) override external view returns (uint) {
        return _transferHistory[user];
    }

    function getReceivedStakingCommissionAmount(address user) override external pure returns(uint256) {
        user;
        return 3 ether;
    }

    function getReceivedCTHRewardAmount(address user) override external view returns (uint) {
        return _cthTransferHistory[user];
    }

    /**********************************************************************************************************
    * operator management
    **********************************************************************************************************/

    function setTicketSigner(address signer) override pure external {
        signer;
    }

    /**********************************************************************************************************
    * pool management
    **********************************************************************************************************/

    function supplyStakingPool(uint startDay, uint amount) override pure external {
        startDay; amount;
    }

    function recycleStakingPool(uint startDay, uint targetDay) override pure external {
        startDay; targetDay;
    }

    function supplyCTHPool(uint amount) override pure external {
        amount;
    }

    /**********************************************************************************************************
    * self Txs
    **********************************************************************************************************/

    function claimStakingReward() override public returns(uint) {
        return _transferStakingReward(msg.sender);
    }

    function claimStakingCommission(address validator) override external pure returns(uint256) {
        validator;
        return 0;
    }

    function claimCTHReward(CTHRewardTransferTicket calldata ticket) override public returns(uint) {
        return _transferCTHReward(ticket.receiver, ticket.accumulatedAmount);
    }

    function claimRewards(CTHRewardTransferTicket calldata ticket) override external returns(uint) {
        uint transferredAmount = _transferStakingReward(msg.sender) + _transferCTHReward(ticket.receiver, ticket.accumulatedAmount);
        emit TransferredRewards(msg.sender, ticket.receiver, transferredAmount);
        return transferredAmount;
    }

    /**********************************************************************************************************
    * meta Txs
    **********************************************************************************************************/

    function metaClaimStakingReward(StakingRewardTransferTicket calldata ticket, uint limitDays) override external returns(uint) {
        limitDays;
        return _transferStakingReward(ticket.receiver);
    }

    function metaClaimCTHReward(CTHRewardTransferTicket calldata ticket) override external returns(uint) {
        return _transferCTHReward(ticket.receiver, ticket.accumulatedAmount);
    }

    function metaClaimRewards(RewardTransferTickets calldata tickets, uint limitDays) override external returns(uint) {
        require(tickets.ticketForStaking.receiver == tickets.ticketForCTH.receiver);
        limitDays;
        return _transferRewards(tickets.ticketForCTH.receiver, tickets.ticketForCTH.accumulatedAmount);
    }

    function metaClaimRewardsWithList(RewardTransferTickets[] calldata ticketsList, uint limitDays) override external returns(uint) {
        limitDays;

        uint transferredAmount = 0;
        for ( uint i = 0; i < ticketsList.length; i++ ) {
            transferredAmount += _transferRewards(ticketsList[i].ticketForCTH.receiver, ticketsList[i].ticketForCTH.accumulatedAmount);
        }
        return transferredAmount;
    }

    /**********************************************************************************************************
    * private functions
    **********************************************************************************************************/
    function _transferStakingReward(address receiver) internal returns(uint) {
        uint transferredAmount = 1.234 ether;
        uint accumulatedAmount = 2.345 ether;
        emit TransferredStakingReward(msg.sender, receiver, transferredAmount, accumulatedAmount);
        return transferredAmount;
    }

    function _transferCTHReward(address receiver, uint accumulatedAmount) internal returns(uint) {
        uint transferredAmount = 1.234 ether;
        emit TransferredStakingReward(msg.sender, receiver, transferredAmount, accumulatedAmount);
        return transferredAmount;
    }

    function _transferRewards(address receiver, uint cthAccumulatedAmount) internal returns(uint) {
        uint transferredAmount = _transferStakingReward(receiver) + _transferCTHReward(receiver, cthAccumulatedAmount);
        emit TransferredRewards(msg.sender, receiver, transferredAmount);
        return transferredAmount;
    }

}
