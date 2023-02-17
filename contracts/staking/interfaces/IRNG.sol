// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

struct RequestStatus {
    uint day; // day when request was made
    uint256 paid; // amount paid in link
    uint256 max; // the maximum possible number
    bool fulfilled; // whether the request has been successfully fulfilled
    uint256 randomWords; // final computed random number
}


interface IRNG {
    /// @notice Returns whether random number has been generated for "day"
    /// @param day Day to check
    /// @return True if a random number has been generated for "day"
    function hadGeneratedNumber(uint day) external view returns (bool);

    /// @notice Returns random number generated for "day"
    /// @param day Day to check
    /// @return randNumber The random number generated for "day" (will fail if number has not been generated)
    function getRandomNumber(uint day) external view returns (uint256 randNumber);

    /// @notice Returns number of days before request with no callback is abandoned
    /// @return Number of days before request with no callback is abandoned
    function abandonDaysAfterRequesting() external pure returns (uint);

    /// @notice Request random number linked to key "day", where 0 <= randomNumber < maxNumber
    /// @param day The key to request, which is a 0-based day index (can only request 1 number per day)
    /// @param maxNumber Specifies the range of requested number (0 <= randomNumber < maxNumber)
    /// @return requestId The unique request id received from Chainlink when making the request
    function requestRandomWords(uint day, uint256 maxNumber) external returns (uint256 requestId);
    
    /**
     * @dev Emitted when `requester` is granted permission to use RNG generator
     */
    event RequesterGranted(address requester);

    /**
     * @dev Emitted when request for `numWords` pieces of data is sent to RNG source.  `requestId` is unique ID
     *      assigned by the RNG source.
     */
    event RequestSent(uint256 requestId, uint32 numWords);

    /**
     * @dev Emitted when `requestId` is fulfilled.  `randomWords` is unmodded output from RNG source, and `payment` is
            amount of Link token that was used in the request.
     */
    event RequestFulfilled(uint256 requestId, uint256[] randomWords, uint256 payment);

    /**
     * @dev Emitted when Link token `balance` is low (warning to refill!)
     */
    event LinkTokenBalanceTooLow(uint256 balance);

    /**
     * @dev Emitted when Link token `balance` is withdrawn to owner
     */
    event LinkTokenWithdrawn(uint256 balance);

}
