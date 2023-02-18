// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/ITime.sol";
import "./interfaces/IValidator.sol";
import "./utils/ArrayUtils.sol";
import "./utils/UnrenounceableOwnable.sol";

contract ValidatorContract is IValidator, UnrenounceableOwnable, ArrayUtils {
    ITime private immutable _timeContract;

    mapping(address => Validator) _validators;
    address[] _validatorList;
    mapping(address => CommissionChangeRequest) _commissionChangeRequests;
    mapping(address => mapping(uint => uint)) _cachedCommissionRate;
    mapping(address => uint) _initialCommissionRate;
    mapping(address => address) _submitter;
    mapping(address => address) _commissionReceiver;

    // @notice For commission limitation range
    // @notice Will not affect past setting
    uint private minCommission = 50000;      // 5%
    uint private maxCommission = 990000;     // 99%

    modifier onlyValidator() {
        require(checkIfExist(msg.sender), "Validator: Caller is not validator or disabled");
        _;
    }

    constructor(address timeContract_) {
        require(timeContract_ != address(0x0), "Validator: TimeContract is zero address");
        _timeContract = ITime(timeContract_);
    }

    function checkHashChanged(bytes calldata hash) internal view returns(bool) {
        return keccak256(hash) != keccak256(_validators[msg.sender].data);
    }

    function checkCommissionRateChanged(uint commissionRate) internal view returns(bool) {
        if ( _commissionChangeRequests[msg.sender].startDate > 0 ) {
            return commissionRate != _commissionChangeRequests[msg.sender].targetCommission;
        } else {
            return commissionRate != _validators[msg.sender].commission;
        }
    }

    /**
     * @dev Returns whether a `validator` is valid on the system or not.
     */
    function checkIfExist(address validator) public view returns(bool) {
        return _validators[validator].id != address(0x0) && !_validators[validator].disabled;
    }

    /**
     * @dev Returns the submitter of a `validator`.
     */
    function getSubmitter(address validator) public view returns(address) {
        return _submitter[validator];
    }

    /**
     * @dev Returns the commission receiver of a `validator`.
     */
    function getCommissionReceiver(address validator) external view returns(address) {
        return _commissionReceiver[validator];
    }

    /**
     * @dev Returns the state of a `validator`.
     */
    function getValidator(address validator) external view returns(Validator memory) {
        Validator memory output = _validators[validator];
        output.commission = getCommissionRate(validator);
        return output;
    }

    /**
     * @dev Returns all validators address.
     */
    function getAllValidators() override external view returns(address[] memory) {
        address[] memory activeValidator = new address[](_validatorList.length);
        uint count = 0;
        for ( uint i = 0; i < _validatorList.length; i++ ) {
            if ( checkIfExist(_validatorList[i]) ) {
                activeValidator[count] = _validatorList[i];
                count++;
            }
        }

        return _trim(activeValidator, count);
    }

    /**
     * @dev Returns commission rate allowance range.
     */
    function getCommissionRateRange() override external view returns(uint, uint) {
        return (minCommission, maxCommission);
    }

    /**
     * @dev Returns current commission rate of a `validator`.
     */
    function getCommissionRate(address validator) override public view returns(uint) {
        if ( _commissionChangeRequests[validator].startDate > 0 &&
            _timeContract.getCurrentTimeIndex() > _commissionChangeRequests[validator].startDate ) {
            return _commissionChangeRequests[validator].targetCommission;
        }
        return _validators[validator].commission;
    }

    /**
     * @dev Returns commission rate of a `validator` on the `day`.
     */
    function getCommissionRateOfDay(uint day, address validator) override external view returns(uint) {
        if ( _cachedCommissionRate[validator][day] > 0 ) {
            return _cachedCommissionRate[validator][day];
        }

        return _getCommissionRateOfDay(day, validator);
    }

    function _getCommissionRateOfDay(uint day, address validator) internal view returns(uint) {
        for ( uint i = day; i >= 0; i-- ) {
            if ( _commissionChangeRequests[validator].startDate > 0 && i > _commissionChangeRequests[validator].startDate ) {
                return _commissionChangeRequests[validator].targetCommission;
            }

            if ( i == 0 ) break;
        }

        return _initialCommissionRate[validator];
    }

    /**
     * @dev Sets the commission rate allowance range from `min` to `max`.
     *
     * Emits a {CommissionRateRangeUpdated} event.
     */
    function setCommissionRateRange(uint min, uint max) override onlyOwner external {
        require(max <= 990000, "Validator: Max commission rate should be equal or less than 99%");
        require(min <= max, "Validator: Max commission rate should be equal or less than min");
        minCommission = min;
        maxCommission = max;

        emit CommissionRateRangeUpdated(min, max);
    }

    /**
     * @dev Returns a commission rate schedule of a `validator`.
     * @dev No reservation: Returns (0, 0)
     * @dev A reservation exists but already applied: Returns (0, 0)
     * @dev Valid reservation exists: Returns the (scheduled date, rate)
     */
    function getScheduledCommissionRate(address validator) override external view returns (uint, uint) {
        if ( _commissionChangeRequests[validator].startDate > 0 &&
            _timeContract.getCurrentTimeIndex() <= _commissionChangeRequests[validator].startDate ) {
            return (_commissionChangeRequests[validator].startDate, _commissionChangeRequests[validator].targetCommission);
        }
        return (0, 0);
    }

    /**
     * @dev Add a `validator` with manifest as `detail` and initial commission rate as `commissionRate`.
     *
     * Emits a {ValidatorAdded} event.
     */
    function addValidator(address validator, bytes calldata detail, uint commissionRate) override external onlyOwner {
        require(validator != address(0x0), "Validator: Validator is zero address");
        require(!checkIfExist(validator), "Validator: Validator is already registered");
        require(commissionRate >= minCommission && commissionRate <= maxCommission, "Validator: Commission rate is out of range");

        _validators[validator] = Validator(validator, detail, commissionRate, false);
        _submitter[validator] = validator;
        _commissionReceiver[validator] = validator;
        _validatorList.push(validator);

        _initialCommissionRate[validator] = commissionRate;

        emit ValidatorAdded(validator);
    }

    /**
     * @dev Enable a `validator`.
     *
     * Emits a {ValidatorEnabled} event.
     */
    function enableValidator(address validator) override external onlyOwner {
        require(_validators[validator].id != address(0x0), "Validator: Validator is not registered");
        require(_validators[validator].disabled, "Validator: Validator had been already enabled");

        _validators[validator].disabled = false;

        emit ValidatorEnabled(validator);
    }

    /**
     * @dev Disable a `validator`.
     *
     * Emits a {ValidatorDisabled} event.
     */
    function disableValidator(address validator) override external onlyOwner {
        require(_validators[validator].id != address(0x0), "Validator: Validator is not registered");
        require(!_validators[validator].disabled, "Validator: Validator had been already disabled");

        _validators[validator].disabled = true;

        emit ValidatorDisabled(validator);
    }

    /**
     * @dev Updates manifest to `detailHash`.
     *
     * Emits a {DetailUpdated} event.
     */
    function updateDetail(bytes calldata detailHash) override public onlyValidator {
        require(checkHashChanged(detailHash), "Validator: DetailHash not changed");

        _validators[msg.sender].data = detailHash;
        emit DetailUpdated(msg.sender, detailHash);
    }

    /**
     * @dev Updates commission rate to `commissionRate`.
     *
     * Emits a {CommissionRateUpdated} event.
     */
    function updateCommissionRate(uint commissionRate) override public onlyValidator {
        require(commissionRate >= minCommission && commissionRate <= maxCommission, "Validator: Commission rate is out of range");
        require(checkCommissionRateChanged(commissionRate), "Validator: Commission rate not changed");

        uint availableAt = _timeContract.getCurrentTimeIndex() + 7;

        // Update current value if previous scheduled commission is applied
        if ( _commissionChangeRequests[msg.sender].startDate > 0 &&
            _timeContract.getCurrentTimeIndex() > _commissionChangeRequests[msg.sender].startDate ) {
            _validators[msg.sender].commission = _commissionChangeRequests[msg.sender].targetCommission;
        }

        // start date is always 1 week from request time
        _commissionChangeRequests[msg.sender] = CommissionChangeRequest(availableAt, commissionRate);
        emit CommissionRateUpdated(msg.sender, availableAt, commissionRate);
    }

    /**
     * @dev Updates manifest to `detailHash` and commission rate to `commissionRate`.
     */
    function updateValidator(uint commissionRate, bytes calldata detailHash) override external onlyValidator {
        if ( checkCommissionRateChanged(commissionRate) ) {
            updateCommissionRate(commissionRate);
        }
        if ( checkHashChanged(detailHash) ) {
            updateDetail(detailHash);
        }
    }

    /**
     * @dev Sets a new `submitter`.
     */
    function setSubmitter(address submitter) override external onlyValidator {
        require(submitter != address(0x0), "Validator: Submitter is zero address");
        _submitter[msg.sender] = submitter;
    }

    /**
     * @dev Sets a new commission receiver as `receiver`.
     */
    function setCommissionReceiver(address receiver) override external onlyValidator {
        require(receiver != address(0x0), "Validator: Receiver is zero address");
        _commissionReceiver[msg.sender] = receiver;
    }

    /**
     * @dev Updates the cache of commission rate for a `validator` on the `day`
     * @note Basically this function should be called by the LogFileHash contract, but whoever can call it.
     */
    function updateCommissionRateCache(uint day, address validator) override external {
        if ( day >= _timeContract.getCurrentTimeIndex() && checkIfExist(validator) ) {
            _cachedCommissionRate[validator][day] = _getCommissionRateOfDay(day, validator);
        }
    }
}
