// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

interface ITime {
    function getCurrentTimeIndex() external view returns(uint);
}
