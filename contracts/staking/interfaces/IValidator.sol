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

    /**
     * @dev Returns current commission rate of a `validator`.
     */
    function getCommissionRate(address validator) external view returns(uint);

    /**
     * @dev Returns commission rate of a `validator` on the `day`.
     */
    function getCommissionRateOfDay(uint day, address validator) external view returns(uint);

    /**
     * @dev Returns commission rate allowance range.
     */
    function getCommissionRateRange() external view returns(uint, uint);

    /**
     * @dev Returns a commission rate schedule of a `validator`.
     */
    function getScheduledCommissionRate(address validator) external view returns (uint, uint);

    /**
     * @dev Returns whether a `validator` is valid on the system or not.
     */
    function checkIfExist(address validator) external view returns(bool);

    /**
     * @dev Returns the submitter of a `validator`.
     */
    function getSubmitter(address validator) external view returns(address);

    /**
     * @dev Returns the commission receiver of a `validator`.
     */
    function getCommissionReceiver(address validator) external view returns(address);

    /**
     * @dev Returns the state of a `validator`.
     */
    function getValidator(address validator) external view returns(Validator memory);

    /**
     * @dev Returns all validators address.
     */
    function getAllValidators() external view returns(address[] memory);

    /// For owner

    /**
     * @dev Add a `validator` with manifest as `detail` and initial commission rate as `commissionRate`.
     */
    function addValidator(address validator, bytes calldata detail, uint commissionRate) external;

    /**
     * @dev Enable a `validator`.
     */
    function enableValidator(address validator) external;

    /**
     * @dev Disable a `validator`.
     */
    function disableValidator(address validator) external;

    /**
     * @dev Sets the commission rate allowance range from `min` to `max`.
     */
    function setCommissionRateRange(uint min, uint max) external;

    /// For validators

    /**
     * @dev Updates manifest to `detailHash`.
     */
    function updateDetail(bytes calldata detailHash) external;

    /**
     * @dev Updates commission rate to `commissionRate`.
     */
    function updateCommissionRate(uint commissionRate) external;

    /**
     * @dev Updates manifest to `detailHash` and commission rate to `commissionRate`.
     */
    function updateValidator(uint commissionRate, bytes calldata detailHash) external;

    /**
     * @dev Sets a new `submitter`.
     */
    function setSubmitter(address submitter) external;

    /**
     * @dev Sets a new commission receiver as `receiver`.
     */
    function setCommissionReceiver(address receiver) external;

    /// For cache

    /**
     * @dev Updates the cache of commission rate for a `validator` on the `day`
     * @note Basically this function should be called by the LogFileHash contract, but whoever can call it.
     */
    function updateCommissionRateCache(uint day, address validator) external;

    /// Events

    /**
     * @dev Emitted when the `validator` added.
     */
    event ValidatorAdded(address indexed validator);

    /**
     * @dev Emitted when the `validator` disabled.
     */
    event ValidatorDisabled(address indexed validator);

    /**
     * @dev Emitted when the `validator` enabled.
     */
    event ValidatorEnabled(address indexed validator);

    /**
     * @dev Emitted when the `validator` updated with the manifest as `detailHash`.
     */
    event DetailUpdated(address indexed validator, bytes detailHash);

    /**
     * @dev Emitted when the `validator` commission rate scheduled to the new `rate` on the `availableAt` day.
     */
    event CommissionRateUpdated(address indexed validator, uint availableAt, uint rate);

    /**
     * @dev Emitted when the commission rate allowance updated with the range from `min` to `max`.
     */
    event CommissionRateRangeUpdated(uint min, uint max);
}
