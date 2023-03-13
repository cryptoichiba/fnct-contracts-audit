// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./interfaces/ITime.sol";
import "./interfaces/IStaking.sol";
import "./interfaces/IValidator.sol";
import "./interfaces/ILogFileHash.sol";
import "./interfaces/IRNG.sol";
import "./utils/ArrayUtils.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract LogFileHash is ILogFileHash, ReentrancyGuard {
    IStaking private immutable _stakingContract;
    IValidator private immutable _validatorContract;
    ITime private immutable _timeContract;
    IRNG private immutable _rng;

    mapping(uint => ValidationRecord[]) _validationRecords;
    mapping(uint => bool) _validationSubmitted;
    mapping(uint => bool) _hadRequestedOrSkipped;
    mapping(uint => address[]) _participatedValidators;
    mapping(uint => address[]) _majorityValidators;
    bytes[] _validFileHash;

    struct Winner {
        address winner;
        WinnerStatus status;
    }
    mapping(uint => Winner) _decidedWinner;
    mapping(uint => bool) _isDecidedWinner;

    /**
     * @notice Constructor
     *
     * @param timeContract_         Address of Time contract.
     * @param stakingContract_      Address of StakingContract.
     * @param validatorContract_    Address of ValidatorContract.
     * @param rng_                  Address of RundomNumberGenerator contract.
     * @param preValidatedHash      Valid file hashes before launched.
     */
    constructor(
        address timeContract_,
        address stakingContract_,
        address validatorContract_,
        address rng_,
        bytes[] memory preValidatedHash
    ) {
        require(timeContract_ != address(0x0), "LogFileHash: TimeContract is zero address");
        require(stakingContract_ != address(0x0), "LogFileHash: StakingContract is zero address");
        require(validatorContract_ != address(0x0), "LogFileHash: ValidatorContract is zero address");
        require(rng_ != address(0x0), "LogFileHash: RundomNumberGenerator is zero address");

        _timeContract = ITime(timeContract_);
        _stakingContract = IStaking(stakingContract_);
        _validatorContract = IValidator(validatorContract_);
        _rng = IRNG(rng_);

        _validFileHash = preValidatedHash;
    }

    /**
     * @notice Returns the latest valid file number and hash.
     */
    function getLatestValidFile() override external view returns (uint, bytes memory) {
        require( _validFileHash.length > 0, "LogFileHash: No valid file yet" );

        uint currentIndex = _validFileHash.length - 1;
        return (currentIndex, _validFileHash[currentIndex]);
    }

    /**
     * @notice Returns the file hash for a `fileNum`.
     */
    function getValidFileHash(uint fileNum) override external view returns(bytes memory) {
        return _validFileHash[fileNum];
    }

    /**
     * @notice Returns the number of participant validators for a `day`.
     */
    function getParticipatedValidators(uint day) override external view returns(address[] memory) {
        return _participatedValidators[day];
    }

    /**
     * @notice Returns the "majority" validators in the participant for a `day`.
     */
    function getMajorityValidators(uint day) override external view returns(address[] memory) {
        return _majorityValidators[day];
    }

    /**
     * @notice Returns the winner validator, if one exists, and WinnerStatus for a `day`.
     */
    function getWinner(uint day) public view returns(address, WinnerStatus) {
        if ( _isDecidedWinner[day] ) {
            return (_decidedWinner[day].winner, _decidedWinner[day].status);
        }

        // NoWinnerForFutureDate: for the future date
        if ( day >= _timeContract.getCurrentTimeIndex() ) {
            return (address(0), WinnerStatus.NoWinnerForFutureDate);
        }

        // Pending winner: no submission yet for the day
        if ( !_hadRequestedOrSkipped[day] ) {
            return (address(0), WinnerStatus.NoSubmissionToday);
        }

        // No winner: in case of no majority hash
        if ( _majorityValidators[day].length == 0 ) {
            return (address(0), WinnerStatus.NoMajority);
        }

        // Pending winner: rng processing
        if ( !_rng.hadGeneratedNumber(day) ) {
            uint today = _timeContract.getCurrentTimeIndex();
            if ( today - day > _rng.abandonDaysAfterRequesting() ) {
                // 30 days after random number requested
                return (address(0), WinnerStatus.Abandoned);
            } else {
                return (address(0), WinnerStatus.Pending);
            }
        }

        // Select winner: from majority hash
        uint256 pseudoRand = _rng.getRandomNumber(day);
        return (_getWinnerFromMajority(day, pseudoRand), WinnerStatus.Decided);
    }

    /**
     * @notice Returns a immutable winner validator's address from the majority validators for a `day` according to the generated random number `pseudoRand`.
     * @dev Winning probability is proportional to the delegated tokens amount.
     */
    function _getWinnerFromMajority(uint day, uint256 pseudoRand) internal view returns (address) {
        address winner = _majorityValidators[day][0];
        uint pointer = 0;
        for ( uint i = 0; i < _majorityValidators[day].length; i++ ) {
            uint delegatedAmount = _stakingContract.getTotalDelegatedTo(day, _majorityValidators[day][i]);

            if ( pointer + delegatedAmount > pseudoRand && pointer <= pseudoRand ) {
                winner = _majorityValidators[day][i];
            }
            pointer += delegatedAmount;
        }
        return winner;
    }

    /**
     * @notice Returns the majority file hash, validators, participant validators and majority voting power for a `day`.
     */
    function getMajority(uint day) public view returns (bytes memory, address[] memory, address[] memory, uint256) {
        if ( !_validationSubmitted[day] ) {
            bytes memory empty;
            address[] memory emptyArray;
            return (empty, emptyArray, emptyArray, 0);
        }

        address[][] memory validators;
        uint[] memory validatorCounters;
        address[] memory registered;
        bytes[] memory hashes;
        (validators, validatorCounters, registered, hashes) = _calcValidatorMaps(_validationRecords[day]);

        // check max power
        uint256 maxPower = 0;
        uint maxKey = 0;
        (maxPower, maxKey) = _getMajorPower(day, validators);

        // in case of no majority hash
        if ( maxPower == 0 ) {
            bytes memory empty;
            address[] memory emptyArray;
            return (empty, emptyArray, registered, 0);
        } else {
            address[] memory majorities = ArrayUtils.reverse(ArrayUtils.trim(validators[maxKey], validatorCounters[maxKey]));
            return (hashes[maxKey], majorities, registered, maxPower);
        }
    }

    /**
     * @notice Returns participant validators, numbers of validates for each file hash group, participant validators and file hashes for a day.
     */
    function _calcValidatorMaps(ValidationRecord[] memory records)
        internal pure returns(address[][] memory, uint[] memory, address[] memory, bytes[] memory) {
        string[] memory keys = new string[](records.length);
        bytes[] memory hashes = new bytes[](records.length);

        // save unique keys
        uint count = 0;
        for ( uint i = 0; i < records.length; i++ ) {
            if ( !ArrayUtils.includeString(keys, records[i].key) ) {
                keys[count] = records[i].key;
                hashes[count] = records[i].hash;
                count++;
            }
        }

        // save unique validators of each keys
        address[][] memory validators = new address[][](keys.length);
        for ( uint i = 0; i < keys.length; i++ ) {
            validators[i] = new address[](records.length);
        }

        address[] memory registeredValidators = new address[](records.length);
        uint[] memory validatorCounters = new uint[](keys.length);
        uint registeredSize = 0;

        for ( uint i = records.length - 1; ; i-- ) {
            for ( uint j = 0; j < keys.length; j++ ) {
                if ( ArrayUtils.isSameString(keys[j], records[i].key) && !ArrayUtils.includeAddress(registeredValidators, records[i].validator)) {
                    validators[j][validatorCounters[j]] = records[i].validator;
                    validatorCounters[j]++;
                    registeredValidators[registeredSize] = records[i].validator;
                    registeredSize++;
                }
            }

            if ( i == 0 ) {
                break;
            }
        }

        address[] memory registered = ArrayUtils.reverse(ArrayUtils.trim(registeredValidators, registeredSize));

        return(validators, validatorCounters, registered, hashes);
    }

    /**
     * @notice Returns the total voting power of majority file hash and the index of the majority file hash group from `validators` grouped by hash for a `day`.
     */
    function _getMajorPower(uint day, address[][] memory validators) view internal returns(uint256, uint256) {
        uint256 total = 0;
        uint256 maxPower = 0;
        uint256 maxKey = 0;
        for ( uint i = 0; i < validators.length; i++ ) {
            uint256 power = 0;
            for ( uint j = 0; j < validators[i].length; j++ ) {
                if ( validators[i][j] != address(0x0) ) {
                    power += _stakingContract.getTotalDelegatedTo(day, validators[i][j]);
                }
            }

            total += power;

            if ( power > maxPower ) {
                maxPower = power;
                maxKey = i;
            }
        }

        // Is there more than a majority?
        if ( maxPower * 2 > total ) {
            return (maxPower, maxKey);
        } else {
            return (0, 0);
        }
    }

    /**
     * @notice Submit current and next file hash as a `validator`.
     * @dev currentHash and nextHash can be empty when no latest file exists.
     * @dev `validator` can submit a file with `submitter` role account.
     *
     * @notice Internally, this does two things:
     *         1. Record a file hash as a "Validation".
     *         2. Request a random seed for the validator selection in case of the first submitter in a day.
     *
     * Emits a {HashSubmitted} event.
     */
    function submit(address validator, uint currentFileNum, bytes calldata currentHash, bytes calldata nextHash) override external nonReentrant {
        require(_validatorContract.checkIfExist(validator), "LogFileHash: Validator is not in the whitelist");
        require(_validatorContract.getSubmitter(validator) == msg.sender, "LogFileHash: Sender is allowed as a submitter");

        // Check specified file number matches the contract has or not
        require(_validFileHash.length == currentFileNum, "LogFileHash: Index is invalid");
        uint today = _timeContract.getCurrentTimeIndex();

        bytes memory hash = currentHash;
        uint majorityValidationPower;
        uint evalDay;

        if ( today > 0 ) {
            // Target day starts with yesterday
            for ( evalDay = today - 1; ; evalDay-- ) {
                // Already requested on the target day?
                if ( _hadRequestedOrSkipped[evalDay] ) break;

                // Skip if no majority validation selection
                bytes memory majorityFileHash;
                address[] memory majorityValidators;
                address[] memory participatedValidators;

                (majorityFileHash, majorityValidators, participatedValidators, majorityValidationPower) = getMajority(evalDay);
                if ( majorityValidators.length > 0 ) {
                    if ( majorityFileHash.length > 0 ) {
                        // if previous majority is null hash, keep submitting for the current file
                        _validFileHash.push(majorityFileHash);
                        hash = nextHash;
                    }

                    _rng.requestRandomWords(evalDay, majorityValidationPower);

                    _majorityValidators[evalDay] = majorityValidators;
                    _participatedValidators[evalDay] = participatedValidators;

                    updateWinner(today);
                }

                _hadRequestedOrSkipped[evalDay] = true;

                if ( evalDay == 0 ) break;
            }
        }

        string memory key = string.concat(Strings.toString(_validFileHash.length), "-", _bytesToHex(hash));
        _validationRecords[today].push(ValidationRecord(today, _validFileHash.length, validator, hash, key));
        _validationSubmitted[today] = true;

        if ( today > 0 ) {
            // Ensure previous date total delegated power
            _stakingContract.updateTotalDelegated(today - 1, validator);
            // Update validator commission rate cache to prepare for today's submission
            _validatorContract.updateCommissionRateCache(today, validator);
        }

        emit HashSubmitted(today, _validFileHash.length, validator, msg.sender, hash, key);
    }

    /**
     * @notice Store the winner and status which had been decided for a day from day:0 to `today`.
     */
    function updateWinner(uint today) internal {
        for ( uint day = 0; day < today; day++ ) {
            if ( !_isDecidedWinner[day] && _hadRequestedOrSkipped[day] ) {
                address winner;
                WinnerStatus status;
                (winner, status) = getWinner(day);
                if ( status != WinnerStatus.Pending && status != WinnerStatus.Abandoned ) {
                    _decidedWinner[day] = Winner(winner, status);
                    _isDecidedWinner[day] = true;
                    break;
                }
            }
        }
    }

    function _bytesToHex(bytes memory buffer) internal pure returns (string memory) {
        // Fixed buffer size for hexadecimal convertion
        bytes memory converted = new bytes(buffer.length * 2);

        bytes memory _base = "0123456789abcdef";

        for ( uint256 i = 0; i < buffer.length; i++ ) {
            converted[i * 2] = _base[uint8(buffer[i]) / _base.length];
            converted[i * 2 + 1] = _base[uint8(buffer[i]) % _base.length];
        }

        return string(abi.encodePacked(converted));
    }

}
