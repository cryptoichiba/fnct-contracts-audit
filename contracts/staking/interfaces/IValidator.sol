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
     * @notice Returns current commission rate of a `validator`.
     */
    function getCommissionRate(address validator) external view returns(uint);

    /**
     * @notice Returns commission rate of a `validator` on the `day`.
     */
    function getCommissionRateOfDay(uint day, address validator) external view returns(uint);

    /**
     * @notice Returns commission rate allowance range.
     */
    function getCommissionRateRange() external view returns(uint, uint);

    /**
     * @notice Returns a commission rate schedule of a `validator`.
     */
    function getScheduledCommissionRate(address validator) external view returns (uint, uint);

    /**
     * @notice Returns whether a `validator` is valid on the system or not.
     */
    function checkIfExist(address validator) external view returns(bool);

    /**
     * @notice Returns the submitter of a `validator`.
     */
    function getSubmitter(address validator) external view returns(address);

    /**
     * @notice Returns the commission receiver of a `validator`.
     */
    function getCommissionReceiver(address validator) external view returns(address);

    /**
     * @notice Returns the state of a `validator`.
     */
    function getValidator(address validator) external view returns(Validator memory);

    /**
     * @notice Returns all validators address.
     */
    function getAllValidators() external view returns(address[] memory);

    /// For owner

    /**
     * @notice Add a `validator` with manifest as `detail` and initial commission rate as `commissionRate`.
     */
    function addValidator(address validator, bytes calldata detail, uint commissionRate) external;

    /**
     * @notice Enable a `validator`.
     */
    function enableValidator(address validator) external;

    /**
     * @notice Disable a `validator`.
     */
    function disableValidator(address validator) external;

    /**
     * @notice Sets the commission rate allowance range from `min` to `max`.
     */
    function setCommissionRateRange(uint min, uint max) external;

    /// For validators

    /**
     * @notice Updates manifest to `detailHash`.
     */
    function updateDetail(bytes calldata detailHash) external;

    /**
     * @notice Updates commission rate to `commissionRate`.
     */
    function updateCommissionRate(uint commissionRate) external;

    /**
     * @notice Updates manifest to `detailHash` and commission rate to `commissionRate`.
     */
    function updateValidator(uint commissionRate, bytes calldata detailHash) external;

    /**
     * @notice Sets a new `submitter`.
     */
    function setSubmitter(address submitter) external;

    /**
     * @notice Sets a new commission receiver as `receiver`.
     */
    function setCommissionReceiver(address receiver) external;

    /// For cache

    /**
     * @notice Updates the cache of commission rate for a `validator` on the `day`
     * @dev Basically this function should be called by the LogFileHash contract, but whoever can call it.
     */
    function updateCommissionRateCache(uint day, address validator) external;

    /// Events

    /**
     * @notice Emitted when the `validator` added.
     */
    event ValidatorAdded(address indexed validator);

    /**
     * @notice Emitted when the `validator` disabled.
     */
    event ValidatorDisabled(address indexed validator);

    /**
     * @notice Emitted when the `validator` enabled.
     */
    event ValidatorEnabled(address indexed validator);

    /**
     * @notice Emitted when the `validator` updated with the manifest as `detailHash`.
     */
    event DetailUpdated(address indexed validator, bytes detailHash);

    /**
     * @notice Emitted when the `validator` commission rate scheduled to the new `rate` on the `availableAt` day.
     */
    event CommissionRateUpdated(address indexed validator, uint availableAt, uint rate);

    /**
     * @notice Emitted when the commission rate allowance updated with the range from `min` to `max`.
     */
    event CommissionRateRangeUpdated(uint min, uint max);
}
