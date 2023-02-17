// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/ITime.sol";
import "./interfaces/IStaking.sol";
import "./interfaces/IVault.sol";
import "./interfaces/IValidator.sol";
import "./utils/ArrayUtils.sol";
import "./utils/UnrenounceableOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract StakingContract is IStaking, UnrenounceableOwnable, ArrayUtils {
    ITime private immutable _timeContract;
    IVault private immutable _vaultContract;
    IValidator private immutable _validatorContract;

    mapping(address => Selection[]) _validatorSelection;
    mapping(address => mapping(uint => uint256)) _totalValidationPowerHistory;
    mapping(address => mapping(uint => bool)) _totalValidationPowerUpdated;
    mapping(address => uint256) _validationPowerForValidator;
    mapping(address => uint256) _validationPowerByDelegator;
    mapping(address => address) _delegateValidator;
    mapping(address => uint) _lastDelegatedDay;
    mapping(address => bool) _isUser;
    mapping(uint => mapping(address => uint)) _delegatedAmounts;
    address[] _users;

    constructor(address timeContract_, address vaultContract_, address validatorContract_) {
        require(timeContract_ != address(0x0), "Staking: TimeContract is zero address");
        require(vaultContract_ != address(0x0), "Staking: VaultContract is zero address");
        require(validatorContract_ != address(0x0), "Staking: ValidatorContract is zero address");

        _timeContract = ITime(timeContract_);
        _vaultContract = IVault(vaultContract_);
        _validatorContract = IValidator(validatorContract_);
    }

    function getValidatorOfDay(uint day, address user) override external view returns (address) {
        if ( _validatorSelection[user].length <= 0 ) {
            return address(0);
        }

        for ( uint i = _validatorSelection[user].length - 1; i >= 0; i-- ) {
            Selection memory selection = _validatorSelection[user][i];
            if ( selection.day <= day ) {
                return selection.validator;
            }

            if ( i == 0 ) break;
        }

        return address(0);
    }

    function getTotalDelegatedTo(uint day, address validator) override public view returns (uint256) {
        for ( uint i = day; i >= 0 ; i-- ) {
            if ( _totalValidationPowerUpdated[validator][i] ) {
                return _totalValidationPowerHistory[validator][i];
            }

            if ( i == 0 ) break;
        }

        return 0;
    }

    function updateTotalDelegated(uint day, address validator) override external {
        if ( !_totalValidationPowerUpdated[validator][day] ) {
            _totalValidationPowerHistory[validator][day] = getTotalDelegatedTo(day, validator);
            _totalValidationPowerUpdated[validator][day] = true;
        }
    }

    function getDelegators(uint day, address validator) external view returns (address[] memory) {
        address[] memory _delegators = new address[](_users.length);
        uint count = 0;

        for ( uint i = 0; i < _users.length; i++ ) {
            address user = _users[i];
            Selection[] memory records =_validatorSelection[user];
            for ( uint j = records.length - 1; j >= 0; j-- ) {
                if( records[j].day <= day && records[j].validator == validator ) {
                    _delegators[count] = user;
                    count++;
                    break;
                }

                if ( j == 0 ) break;
            }
        }

        return _trim(_delegators, count);
    }

    /*
        Returns amount of tokens specified user has locked.
    */
    function calcLock(address user) override external view returns (uint256) {
        return _vaultContract.calcLock(user);
    }

    /*
        Returns amount of tokens specified user can unlock.
    */
    function calcUnlockable(address user) override external view returns (uint256) {
        return _vaultContract.calcUnlockable(user);
    }

    /*
        Returns the last validator specified user delegated to.
    */
    function getValidator(address user) override external view returns (address) {
        return _delegateValidator[user];
    }

    /*
        A user changed validator in the last 24 hours, then return False.
    */
    function canChangeValidator(address user) override public view returns (bool) {
        uint today = _timeContract.getCurrentTimeIndex();
        return !_isUser[user] || _lastDelegatedDay[user] < today;
    }

    /*
        Will lock specified amount of tokens from your wallet and delegate it to specidied validator.
        Emits event with your wallet address, chosen new validator, empty address for an old validatir and amount sent.
    */
    function lockAndDelegate(uint256 amount, address validator) override external {
        require(validator == address(0x0) || _validatorContract.checkIfExist(validator), "Staking: Validator is not in the whitelist");
        require(canChangeValidator(msg.sender) || _delegateValidator[msg.sender] == validator, "Staking: You can't change a validator on the same day");

        if ( !_isUser[msg.sender] ) {
            _users.push(msg.sender);
            _isUser[msg.sender] = true;
        }

        uint today = _timeContract.getCurrentTimeIndex();

        // Decrease previous validator
        address previousValidator = _delegateValidator[msg.sender];
        if ( previousValidator != address(0x0) ) {
            _validationPowerForValidator[previousValidator] -= _validationPowerByDelegator[msg.sender];
            _totalValidationPowerHistory[previousValidator][today] = _validationPowerForValidator[previousValidator];
            _totalValidationPowerUpdated[previousValidator][today] = true;
        }

        _delegateValidator[msg.sender] = validator;
        _lastDelegatedDay[msg.sender] = today;
        _validatorSelection[msg.sender].push(Selection(today, validator));
        _validationPowerByDelegator[msg.sender] += amount;

        // Increase new validator
        if ( validator != address(0x0) ) {
            _validationPowerForValidator[validator] += _validationPowerByDelegator[msg.sender];
            _totalValidationPowerHistory[validator][today] = _validationPowerForValidator[validator];
            _totalValidationPowerUpdated[validator][today] = true;
        }

        if ( amount > 0 ) {
            _vaultContract.addLock(msg.sender, amount);
        }

        emit LockedAndDelegated(msg.sender, validator, previousValidator, amount);
    }

    function unlock(uint256 amount) override external {
        require(amount > 0, "Staking: Amount is zero");

        uint today = _timeContract.getCurrentTimeIndex();

        address validator = _delegateValidator[msg.sender];
        if ( validator != address(0x0) ) {
            _validationPowerForValidator[validator] -= amount;
            _totalValidationPowerHistory[validator][today] = _validationPowerForValidator[validator];
            _totalValidationPowerUpdated[validator][today] = true;
        }

        _vaultContract.unlock(msg.sender, amount);

        emit Unlocked(msg.sender, _delegateValidator[msg.sender], amount);
    }

}
