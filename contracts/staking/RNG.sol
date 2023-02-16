// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/IRNG.sol";
import "./interfaces/ITime.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/VRFV2WrapperConsumerBase.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

 /**
  * @title Random number generator running on top of Chainlink.
  * @notice Calling requestRandomWords() triggers a request to Chainlink; after Chainlink calls fulfillRandomWords() callback,
  *         random result can be retrieved from getRandomNumber().
  * @dev    Random numbers from this contract are used by the LogFileHash contract to choose "winning" validators each day in the
  *         validation lottery.
  *         (details of that calculation are left to LogFileHash; this function simply provides a single number between 0 and
  *         maxNumber)
  */
contract RandomNumberGenerator is VRFV2WrapperConsumerBase, AccessControl, ConfirmedOwner, IRNG {
    ITime private immutable _timeContract;

    // Requests to RandomNumberGenerator are asynchronous and request data is stored in RequestStatus objects.
    // "requestHistory" is [day/index]->RequestStatus mapping; "requests" is [Chainlink Request Id]->RequestStatus mapping
    mapping(uint => RequestStatus) requestHistory;
    mapping(uint256 => RequestStatus) requests;
    uint256 lastRequestId;

    bytes32 public constant REQUESTER_ROLE = keccak256("REQUESTER_ROLE");

    // Max gas to use when Chainlink calls fulfillRandomWords()
    // For reference, experimentally detected gas usage was ~275,000gas
    // ( https://polygonscan.com/tx/0x4aff19b1e3f43ffa9bc6fad77ae9e311f3e9f1bd6185ebe01f0e94ca745e2611 )
    //
    // callbackGasLimit amount will always be consumed, so there is a cost penalty for a high value.
    // However this is Polygon network and there's only 1 RNG pulled per day, so penalty is
    // tolerable to some extent.  We set callbackGasLimit to be roughly 4x current usage.
    uint32 private constant callbackGasLimit = 1000000;

    // Request confirmations before fulfillRandomWords() is called
    uint16 private immutable requestConfirmations;

    // Currently retrieving 1 random value per request
    uint32 private constant numWords = 1;

    // Request is considered "abandoned" after 30 days; after this time contract will no longer accept callback from
    // Chainlink and system is free to put lottery into WinnerStatus.Abandoned.
    uint private constant _abandonDaysAfterRequesting = 30;

    /// @notice Constructor
    /// @param linkAddress Address of Chainlink LinkToken
    /// @param wrapperAddress Address of Chainlink VRFV2Wrapper contract
    /// @param confirmations Number of confirmations to wait after requestRandomWords() before callback
    /// @param timeContract Address of Time contract
    constructor(address linkAddress, address wrapperAddress, uint16 confirmations, address timeContract)
        ConfirmedOwner(msg.sender)
        VRFV2WrapperConsumerBase(linkAddress, wrapperAddress) {
        require(linkAddress != address(0x0), "RandomNumber: LinkAddress is zero address");
        require(wrapperAddress != address(0x0), "RandomNumber: WrapperAddress is zero address");
        require(timeContract != address(0x0), "RandomNumber: TimeContract is zero address");

        requestConfirmations = confirmations;
        _timeContract = ITime(timeContract);
    }

    /// @notice Returns whether random number has been generated for "day"
    /// @param day Day to check
    /// @return True if a random number has been generated for "day"
    function hadGeneratedNumber(uint day) external view returns (bool) {
        return requestHistory[day].paid > 0 && requestHistory[day].fulfilled;
    }

    /// @notice Returns random number generated for "day"
    /// @param day Day to check
    /// @return randNumber The random number generated for "day" (will fail if number has not been generated)
    function getRandomNumber(uint day) external view returns (uint256 randNumber) {
        require(requestHistory[day].fulfilled, "RandomNumber: Not generated the number yet");

        return  requestHistory[day].randomWords;
    }

    /// @notice Returns number of days before request with no callback is abandoned
    /// @return Number of days before request with no callback is abandoned
    function abandonDaysAfterRequesting() external pure returns (uint) {
        return _abandonDaysAfterRequesting;
    }

    /// @notice Grant permission to make RNG requests from "requester" address
    /// @param requester Address to whitelist
    function setRequester(address requester) external onlyOwner {
        require(requester != address(0x0), "RandomNumber: Requester is zero address");

        _grantRole(REQUESTER_ROLE, requester);

        emit RequesterGranted(requester);
    }

    /// @notice Request random number linked to key "day", where 0 <= randomNumber < maxNumber
    /// @param day The key to request, which is a 0-based day index (can only request 1 number per day)
    /// @param maxNumber Specifies the range of requested number (0 <= randomNumber < maxNumber)
    /// @return requestId The unique request id received from Chainlink when making the request
    function requestRandomWords(uint day, uint256 maxNumber) external onlyRole(REQUESTER_ROLE) returns (uint256 requestId) {
        require(requestHistory[day].paid == 0, "RandomNumber: Today's request has been already paid");

        // Make request
        requestId = requestRandomness(callbackGasLimit, requestConfirmations, numWords);
        require(requests[requestId].day == 0, "RandomNumber: Request ID is duplicated");

        // Insert request status data into "requestHistory" and "requests" mappings.
        RequestStatus memory status = RequestStatus({
            day: day,
            paid: VRF_V2_WRAPPER.calculateRequestPrice(callbackGasLimit),
            max: maxNumber,
            randomWords: 0,
            fulfilled: false
        });
        requestHistory[day] = status;
        requests[requestId] = status;
        lastRequestId = requestId;

        // Link token balance warning when the token balance < 30 requests
        uint256 balance = LINK.balanceOf(address(this));
        if ( balance < status.paid * 30 ) {
            emit LinkTokenBalanceTooLow(balance);
        }

        emit RequestSent(requestId, numWords);

        return requestId;
    }

    /// @notice Chainlink callback to receive random value requested from requestRandomWords()
    /// @param requestId Unique Chainlink request id for request that Chainlink is responding to
    /// @param randomWords An array of random values (in our case, we're always requesting an array of length 1)
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        require(requests[requestId].paid > 0, 'RandomNumber: Request not found');
        require(!requests[requestId].fulfilled, 'RandomNumber: Callback was received twice');
        require(requests[requestId].day <= _abandonDaysAfterRequesting, 'RandomNumber: Callback was received after abandoned');

        // Convert input random word into a random number of requested range
        uint randomNumber = randomWords[0] % requests[requestId].max;

        // Update request status data with the results
        requestHistory[requests[requestId].day].fulfilled = true;
        requestHistory[requests[requestId].day].randomWords = randomNumber;
        requests[requestId].fulfilled = true;
        requests[requestId].randomWords = randomNumber;

        emit RequestFulfilled(requestId, randomWords, requests[requestId].paid);
    }

    /// @notice Withdrawal of Link tokens from the contract
    function withdrawLink() external onlyOwner {
        uint256 balance = LINK.balanceOf(address(this));
        require(LINK.transfer(msg.sender, balance), 'RandomNumber: Unable to transfer');

        emit LinkTokenWithdrawn(balance);
    }
}


