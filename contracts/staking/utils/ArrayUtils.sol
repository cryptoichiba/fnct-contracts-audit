// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

library ArrayUtils {

    function includeAddress(address[] memory array, address element) pure internal returns(bool) {
        for ( uint i = 0; i < array.length; i++ ) {
            if (element == array[i]) {
                return true;
            }
        }
        return false;
    }

    function includeString(string[] memory array, string memory element) pure internal returns(bool) {
        for ( uint i = 0; i < array.length; i++ ) {
            if (isSameString(element, array[i])) {
                return true;
            }
        }
        return false;
    }

    function isSameString(string memory a, string memory b) pure internal returns (bool) {
        if(bytes(a).length != bytes(b).length) {
            return false;
        } else {
            return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
        }
    }

    function reverse(address[] memory elements) pure internal returns(address[] memory) {
        address[] memory outs = new address[](elements.length);

        uint count = 0;
        for ( uint i = elements.length - 1; i >= 0; i-- ) {
            outs[count] = elements[i];
            count++;

            if (i == 0) {
                break;
            }
        }

        return outs;
    }

    function trim(address[] memory elements, uint length) pure internal returns(address[] memory) {
        address[] memory outs = new address[](length);

        for ( uint i = 0; i < length; i++ ) {
            outs[i] = elements[i];
        }

        return outs;
    }

}