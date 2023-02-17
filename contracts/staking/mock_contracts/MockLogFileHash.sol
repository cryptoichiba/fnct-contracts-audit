// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/ILogFileHash.sol";

contract MockLogFileHash is ILogFileHash {
    mapping(uint => address) _winners;
    mapping(uint => WinnerStatus) _winnerStatus;
    mapping(uint => address[]) private _participatedValidators;
    mapping(uint => address[]) private _majorityValidators;

    constructor(address timeContract_, address stakingContract_, address validatorContract_,  address rng_) {
        timeContract_;
        stakingContract_;
        validatorContract_;
        rng_;
    }

    function getLatestValidFile() override external pure returns (uint, bytes memory) {
        return (0,  "0x0");
    }

    function getValidFileHash(uint fileNum) override external pure returns(bytes memory) {
        fileNum;
        return "0x0";
    }

    function getMajority(uint day) public view returns (bytes memory, address[] memory, address[] memory, uint256) {
        return ("0x0", _majorityValidators[day], _participatedValidators[day], 0);
    }

    function getParticipatedValidators(uint day) override external view returns(address[] memory) {
        return _participatedValidators[day];
    }

    function getMajorityValidators(uint day) override external view returns(address[] memory) {
        return _majorityValidators[day];
    }

    function getWinner(uint day) override external view returns(address, WinnerStatus) {
        return (_winners[day], _winnerStatus[day]);

    }

    function setWinner(uint day, address validator, WinnerStatus status) external {
        _winners[day] = validator;
        _winnerStatus[day] = status;
    }

    function setParticipatedValidators(uint day, address[] memory validators) external {
        _participatedValidators[day] = validators;
    }

    function setMajorityValidators(uint day, address[] memory validators) external {
        _majorityValidators[day] = validators;
    }

    function submit(address validator, uint currentFileNum, bytes calldata currentHash, bytes calldata nextHash ) override pure external {
        validator; currentFileNum; currentHash; nextHash;
    }
}
