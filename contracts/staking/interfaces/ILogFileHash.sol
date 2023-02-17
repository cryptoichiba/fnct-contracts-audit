// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

/**
 * @dev Winner decision status for the day
 *      Decided: Winner validator HAD been decided for the day
 *      NoWinnerForFutureDate: Winner validator HAD NOT YET been decided for a future date
 *      NoMajority: Winner validator CAN NOT been decided because no file hash voting power reached more than half
 *      NoSubmissionToday: Winner validator HAD NOT YET been decided until a submission of the next day
 *      Pending: Winner validator HAD NOT YET been decided until the random number generation
 *      Abandoned: Winner validator CAN NOT been decided because of the random number generation failure/delay
 * @note Immutable status: Decided, NoMajority, Abandoned
 *       Mutable status: NoWinnerForFutureDate, NoSubmissionToday, Pending
 */
enum WinnerStatus {
    Decided,
    NoWinnerForFutureDate,
    NoMajority,
    NoSubmissionToday,
    Pending,
    Abandoned
}

/**
 * @dev Interface of the LogFileHash.
 */
interface ILogFileHash {
    event HashSubmitted(uint indexed today, uint indexed fileNum, address indexed validator, address sender, bytes hash, string key);

    struct ValidationRecord {
        uint day;
        uint fileNum;
        address validator;
        bytes hash;
        string key;
    }

    /**
     * @dev Returns the latest valid file number and hash.
     */
    function getLatestValidFile() external view returns (uint, bytes memory);

    /**
     * @dev Returns the file hash for a `fileNum`.
     */
    function getValidFileHash(uint fileNum) external view returns(bytes memory);

    /**
     * @dev Returns the number of participant validators for a `day`.
     */
    function getParticipatedValidators(uint day) external view returns(address[] memory);

    /**
     * @dev Returns the "majority" validators in the participant for a `day`.
     */
    function getMajorityValidators(uint day) external view returns(address[] memory);

    /**
     * @dev Returns the winner validator and/or winner status in the participant for a `day`.
     */
    function getWinner(uint day) external view returns(address, WinnerStatus);

    /**
     * @dev Returns the majority file hash, validators, participant validators and majority voting power for a `day`.
     */
    function getMajority(uint day) external view returns (bytes memory, address[] memory, address[] memory, uint256);

    /**
     * @dev Submit current and next file hash as a `validator`.
     * @note `validator` can submit a file with `submitter` role account.
     *
     * Emits a {HashSubmitted} event
     */
    function submit(address validator, uint currentFileNum, bytes calldata currentHash, bytes calldata nextHash) external;
}
