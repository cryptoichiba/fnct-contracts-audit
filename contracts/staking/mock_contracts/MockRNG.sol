// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "../interfaces/ITime.sol";
import "../interfaces/IRNG.sol";

contract MockRandomNumberGenerator is IRNG {
    mapping(uint => uint256) _randomValue;
    mapping(uint => bool) _requested;
    mapping(uint => bool) _generated;

    constructor(address linkAddress_, address wrapperAddress_, uint16 confirmations) {
        linkAddress_;
        wrapperAddress_;
        confirmations;
    }

    function setRandomNumber(uint day, uint256 value) public {
        _randomValue[day] = value;
        _generated[day] = true;
    }

    function hadGeneratedNumber(uint day) external view returns (bool) {
        return _generated[day];
    }

    function getRandomNumber(uint day) external view returns (uint256 randNumber) {
        return  _randomValue[day];
    }

    function abandonDaysAfterRequesting() external pure returns (uint) {
        return 30;
    }

    // Will request random number, where 0 <= randomNumber < maxNumber
    function requestRandomWords(uint day, uint256 maxNumber) external returns (uint256 requestId) {
        maxNumber;
        _requested[day] = true;
        return day;
    }

}


