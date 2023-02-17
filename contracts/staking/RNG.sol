// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./interfaces/IRNG.sol";
import "./interfaces/ITime.sol";
import "@chainlink/contracts/src/v0.8/ConfirmedOwner.sol";
import "@chainlink/contracts/src/v0.8/VRFV2WrapperConsumerBase.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * Random number generator running on top of Chainlink.
 * Calling requestRandomWords() triggers a request to Chainlink; after Chainlink calls fulfillRandomWords() callback,
 * random result can be retrieved from getRandomNumber().
 */
contract RandomNumberGenerator is VRFV2WrapperConsumerBase, AccessControl, ConfirmedOwner, IRNG {
    ITime private immutable _timeContract;

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

    uint private constant _abandonDaysAfterRequesting = 30;

    constructor(address linkAddress, address wrapperAddress, uint16 confirmations, address timeContract)
        ConfirmedOwner(msg.sender)
        VRFV2WrapperConsumerBase(linkAddress, wrapperAddress) {
        require(linkAddress != address(0x0), "RandomNumber: LinkAddress is zero address");
        require(wrapperAddress != address(0x0), "RandomNumber: WrapperAddress is zero address");
        require(timeContract != address(0x0), "RandomNumber: TimeContract is zero address");

        requestConfirmations = confirmations;
        _timeContract = ITime(timeContract);
    }

    function hadGeneratedNumber(uint day) external view returns (bool) {
        return requestHistory[day].paid > 0 && requestHistory[day].fulfilled;
    }

    function getRandomNumber(uint day) external view returns (uint256 randNumber) {
        require(requestHistory[day].fulfilled, "RandomNumber: Not generated the number yet");

        return  requestHistory[day].randomWords;
    }

    function abandonDaysAfterRequesting() external pure returns (uint) {
        return _abandonDaysAfterRequesting;
    }

    function setRequester(address requester) external onlyOwner {
        require(requester != address(0x0), "RandomNumber: Requester is zero address");

        _grantRole(REQUESTER_ROLE, requester);

        emit RequesterGranted(requester);
    }

    /**
     * Request random number linked to key "day", where 0 <= randomNumber < maxNumber
     */
    function requestRandomWords(uint day, uint256 maxNumber) external onlyRole(REQUESTER_ROLE) returns (uint256 requestId) {
        require(requestHistory[day].paid == 0, "RandomNumber: Today's request has been already paid");

        requestId = requestRandomness(callbackGasLimit, requestConfirmations, numWords);
        require(requests[requestId].day == 0, "RandomNumber: Request ID is duplicated");

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

    /**
     * Chainlink callback to receive random value requested from requestRandomWords()
     */
    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        require(requests[requestId].paid > 0, 'RandomNumber: Request not found');
        require(!requests[requestId].fulfilled, 'RandomNumber: Callback was received twice');
        require(requests[requestId].day <= _abandonDaysAfterRequesting, 'RandomNumber: Callback was received after abandoned');

        uint randomNumber = randomWords[0] % requests[requestId].max;

        requestHistory[requests[requestId].day].fulfilled = true;
        requestHistory[requests[requestId].day].randomWords = randomNumber;
        requests[requestId].fulfilled = true;
        requests[requestId].randomWords = randomNumber;
        emit RequestFulfilled(requestId, randomWords, requests[requestId].paid);
    }

    /**
     * Allow withdraw of Link tokens from the contract
     */
    function withdrawLink() external onlyOwner {
        uint256 balance = LINK.balanceOf(address(this));
        require(LINK.transfer(msg.sender, balance), 'RandomNumber: Unable to transfer');

        emit LinkTokenWithdrawn(balance);
    }
}


