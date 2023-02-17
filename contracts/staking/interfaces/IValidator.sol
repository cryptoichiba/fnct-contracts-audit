// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface IValidator {
    struct Validator {
        address id;
        bytes data;
        uint commission;
        bool disabled;
    }

    struct CommissionChangeRequest {
        uint startDate;
        uint targetCommission;
    }

    event ValidatorAdded(address indexed validator);
    event ValidatorDisabled(address indexed validator);
    event ValidatorEnabled(address indexed validator);
    event DetailUpdated(address indexed validator, bytes detailHash);
    event CommissionRateUpdated(address indexed validator, uint availableAt, uint rate);
    event CommissionRateRangeUpdated(uint min, uint max);

    function getCommissionRate(address validator) external view returns(uint);
    function getCommissionRateOfDay(uint day, address validator) external view returns(uint);
    function getCommissionRateRange() external view returns(uint, uint);
    function getScheduledCommissionRate(address validator) external view returns (uint, uint);
    function checkIfExist(address validator) external view returns(bool);
    function getSubmitter(address validator) external view returns(address);
    function getCommissionReceiver(address validator) external view returns(address);
    function getValidator(address validator) external view returns(Validator memory);
    function getAllValidators() external view returns(address[] memory);

    // For owner
    function addValidator(address validator, bytes calldata detail, uint commissionRate) external;
    function enableValidator(address validator) external;
    function disableValidator(address validator) external;
    function setCommissionRateRange(uint min, uint max) external;

    // For validators
    function updateDetail(bytes calldata detailHash) external;
    function updateCommissionRate(uint commissionRate) external;
    function updateValidator(uint commissionRate, bytes calldata detailHash) external;
    function setSubmitter(address submitter) external;
    function setCommissionReceiver(address receiver) external;

    // For cache
    function updateCommissionRateCache(uint day, address validator) external;
}
