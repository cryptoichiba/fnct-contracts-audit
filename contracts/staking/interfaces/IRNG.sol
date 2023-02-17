// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

struct RequestStatus {
    uint day; // day when request was made
    uint256 paid; // amount paid in link
    uint256 max; // the maximum possible number
    bool fulfilled; // whether the request has been successfully fulfilled
    uint256 randomWords;
}


interface IRNG {
    event RequesterGranted(address requester);
    event RequestSent(uint256 requestId, uint32 numWords);
    event RequestFulfilled(uint256 requestId, uint256[] randomWords, uint256 payment);
    event LinkTokenBalanceTooLow(uint256 balance);
    event LinkTokenWithdrawn(uint256 balance);

    function hadGeneratedNumber(uint day) external view returns (bool);
    function getRandomNumber(uint day) external view returns (uint256 randNumber);
    function abandonDaysAfterRequesting() external pure returns (uint);

    // Will request random number, where 0 <= randomNumber < maxNumber
    function requestRandomWords(uint day, uint256 maxNumber) external returns (uint256 requestId);
}