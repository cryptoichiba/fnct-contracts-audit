// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/IValidator.sol";

contract MockValidatorContract is IValidator {
    uint launchDate;

    constructor() {
        launchDate = block.timestamp;
    }

    function checkIfExist(address validator) override external pure returns(bool) {
        validator;
        return true;
    }

    function getSubmitter(address validator) override external pure returns(address) {
        return validator;
    }

    function getValidator(address validator) override external pure returns(Validator memory) {
        validator;

        bytes memory detail = "0x33";
        return Validator(validator, detail, 10 ** 5, false);
    }

    function getCommissionReceiver(address validator) override external pure returns(address) {
        return validator;
    }

    function getAllValidators() external pure returns(address[] memory) {
        address[] memory empty;
        return empty;
    }

    function enableValidator(address validator) external pure {
        validator;
    }

    function disableValidator(address validator) external pure {
        validator;
    }

    function getCommissionRate(address validator) override external pure returns (uint) {
        validator;
        return 10 ** 5;
    }

    function getCommissionRateOfDay(uint day, address validator) override external pure returns (uint) {
        day; validator;
        return 10 ** 5;
    }

    function getCommissionRateRange() override external pure returns(uint, uint) {
        return (500000, 990000);
    }

    function setCommissionRateRange(uint min, uint max) external {
        min;
        max;

        emit CommissionRateRangeUpdated(min, max);
    }

    function getScheduledCommissionRate(address validator) override external pure returns (uint, uint) {
        validator;

        // 2023-01-22 18:29
        return (1674379754, 11 * 10 ** 4);
    }

    function addValidator(address validator, bytes calldata detail, uint commissionRate) override external pure {
        validator; detail; commissionRate;
    }

    function updateDetail(bytes calldata detailHash) override public {
        emit DetailUpdated(msg.sender, detailHash);
    }

    function updateCommissionRate(uint commissionRate) override public {
        // 2023-01-22 18:29
        emit CommissionRateUpdated(msg.sender, 1674379754, commissionRate);
    }

    function updateValidator(uint commissionRate, bytes calldata detailHash) override external {
        emit CommissionRateUpdated(msg.sender, 1674379754, commissionRate);
        emit DetailUpdated(msg.sender, detailHash);
    }

    function setSubmitter(address submitter) override external pure {
        submitter;
    }

    function setCommissionReceiver(address receiver) override external pure {
        receiver;
    }

    function updateCommissionRateCache(uint day, address validator) override external pure {
        day; validator;
    }


}
