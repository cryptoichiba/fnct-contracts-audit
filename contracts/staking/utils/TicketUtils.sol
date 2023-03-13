// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

library TicketUtils {

    function recoverSigners(
        address receiver,
        address ticketSigner,
        uint256 amount,
        bytes calldata metaSignature,
        bytes calldata bodySignature
    ) internal pure returns(address, address) {
        string memory signedMessage = "\x19Ethereum Signed Message:\n32";

        bytes32 headHash = keccak256(abi.encodePacked(
                signedMessage,
                keccak256(abi.encodePacked(ticketSigner))
            ));
        address headSigner = ECDSA.recover(headHash, metaSignature);

        bytes32 bodyHash = keccak256(abi.encodePacked(
                signedMessage,
                keccak256(abi.encodePacked(receiver, amount))
            ));
        address bodySigner = ECDSA.recover(bodyHash, bodySignature);

        return (headSigner, bodySigner);
    }

}