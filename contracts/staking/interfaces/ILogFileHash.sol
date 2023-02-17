// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

enum WinnerStatus {
    Decided,
    NoWinnerForFutureDate,
    NoMajority,
    NoSubmissionToday,
    Pending,
    Abandoned
}

interface ILogFileHash {
    event HashSubmitted(uint indexed today, uint indexed fileNum, address indexed validator, address sender, bytes hash, string key);

    struct ValidationRecord {
        uint day;
        uint fileNum;
        address validator;
        bytes hash;
        string key;
    }

    function getLatestValidFile() external view returns (uint, bytes memory);
    function getValidFileHash(uint fileNum) external view returns(bytes memory);
    function getParticipatedValidators(uint day) external view returns(address[] memory);
    function getMajorityValidators(uint day) external view returns(address[] memory);
    function getWinner(uint day) external view returns(address, WinnerStatus);
    function getMajority(uint day) external view returns (bytes memory, address[] memory, address[] memory, uint256);

    function submit(address validator, uint currentFileNum, bytes calldata currentHash, bytes calldata nextHash) external;
}
