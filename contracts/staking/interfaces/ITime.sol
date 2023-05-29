// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

interface ITime {
    /// @notice Returns current "day"
    /// @dev Launch Date = 0 Day
    /// @return randNumber Current day index
    function getCurrentTimeIndex() external view returns(uint);
}
