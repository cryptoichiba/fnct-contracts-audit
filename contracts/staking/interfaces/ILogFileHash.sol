// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

/**
 * @notice Winner decision status for the day
 *      Decided: Winner validator HAD been decided for the day
 *      NoWinnerForFutureDate: Winner validator HAD NOT YET been decided for a future date
 *      NoMajority: Winner validator CAN NOT been decided because no file hash voting power reached more than half
 *      NoSubmissionToday: Winner validator HAD NOT YET been decided until a submission of the next day
 *      Pending: Winner validator HAD NOT YET been decided until the random number generation
 *      Abandoned: Winner validator CAN NOT been decided because of the random number generation failure/delay
 * @dev Immutable status: Decided, NoMajority, Abandoned
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
 * @notice Interface of the LogFileHash.
 */
interface ILogFileHash {
    struct ValidationRecord {
        uint day;
        uint fileNum;
        address validator;
        bytes hash;
        string key;
    }

    /**
     * @notice Returns the latest valid file number and hash.
     */
    function getLatestValidFile() external view returns (uint, bytes memory);

    /**
     * @notice Returns the file hash for a `fileNum`.
     */
    function getValidFileHash(uint fileNum) external view returns(bytes memory);

    /**
     * @notice Returns the number of participant validators for a `day`.
     */
    function getParticipatedValidators(uint day) external view returns(address[] memory);

    /**
     * @notice Returns the "majority" validators in the participant for a `day`.
     */
    function getMajorityValidators(uint day) external view returns(address[] memory);

    /**
     * @notice Returns the winner validator and/or winner status in the participant for a `day`.
     */
    function getWinner(uint day) external view returns(address, WinnerStatus);

    /**
     * @notice Returns the majority file hash, validators, participant validators and majority voting power for a `day`.
     */
    function getMajority(uint day) external view returns (bytes memory, address[] memory, address[] memory, uint256);

    /**
     * @notice Submit current and next file hash as a `validator`.
     * @dev `validator` can submit a file with `submitter` role account.
     *
     * Emits a {HashSubmitted} event.
     */
    function submit(address validator, uint currentFileNum, bytes calldata currentHash, bytes calldata nextHash) external;

    /// Events

    /**
     * @notice Emitted when the file `hash` of the `fileNum` file is submitted by a `sender` for a `validator`.
     * @dev `today` is days since launch date.
     * @dev `key` is a combination of accepted file number and the file hash joined with '-'. example: '1-0123456789abcdef'.
     */
    event HashSubmitted(uint indexed today, uint indexed fileNum, address indexed validator, address sender, bytes hash, string key);
}
