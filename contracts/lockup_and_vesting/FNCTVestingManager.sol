// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "./NonCustodialVesting.sol";
import "../staking/utils/UnrenounceableOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FNCTVestingManager is UnrenounceableOwnable {

    address _fnct;

    struct VestingPair {
        address holder;
        address deployedContract;
    }

    mapping(address => address) private _vestingMap;
    VestingPair[] private _vestingList;

    constructor(address fnct_) {
        require(fnct_ != address(0x0), "FNCTVestingManager: FNCT is zero address");
        _fnct = fnct_;
    }

    function deployVesting(
        address[] calldata targets
    ) external onlyOwner {
        require(targets.length > 0, "FNCTVestingManager: No targets");

        for ( uint i = 0; i < targets.length; i++ ) {
            if ( _vestingMap[targets[i]] == address(0x0) ) {
                address deployedContract = address(
                    new NonCustodialVesting(
                        _fnct,
                        targets[i]
                    )
                );
                _vestingMap[targets[i]] = deployedContract;
                _vestingList.push(VestingPair(targets[i], deployedContract));
            }
        }
    }

    function allocateTokens(
        address[] calldata targets,
        uint[] calldata tokenAmounts
    ) external onlyOwner {
        require(targets.length > 0, "FNCTVestingManager: No targets");
        require(tokenAmounts.length > 0, "FNCTVestingManager: No tokenAmounts");
        require(targets.length == tokenAmounts.length, "FNCTVestingManager: Argument array length doesn't match");

        IERC20 fnct = IERC20(_fnct);
        for ( uint i = 0; i < targets.length; i++ ) {
            NonCustodialVesting vesting = NonCustodialVesting(_vestingMap[targets[i]]);
            SafeERC20.safeTransfer(fnct, address(vesting), tokenAmounts[i]);
        }
    }

    function vestTokens(
        address[] calldata targets,
        uint[] calldata tokenAmounts
    ) external onlyOwner {
        require(targets.length > 0, "FNCTVestingManager: No targets");
        require(tokenAmounts.length > 0, "FNCTVestingManager: No tokenAmounts");
        require(targets.length == tokenAmounts.length, "FNCTVestingManager: Argument array length doesn't match");

        for ( uint i = 0; i < targets.length; i++ ) {
            NonCustodialVesting vesting = NonCustodialVesting(_vestingMap[targets[i]]);
            vesting.vestTokens(tokenAmounts[i]);
        }
    }

    function getDeployedContractCount() external view returns (uint) {
        return _vestingList.length;
    }

    function getDeployedContractList(uint start, uint count) external view returns (VestingPair[] memory) {
        require(start < _vestingList.length, "FNCTVestingManager: No targets");
        require(count > 0, "FNCTVestingManager: No targets");
        require(start + count <= _vestingList.length, "FNCTVestingManager: No targets");

        VestingPair[] memory vestingList = new VestingPair[](count);
        for ( uint i = 0; i < count && start + i < _vestingList.length; i++ ) {
            vestingList[i] = _vestingList[start + i];
        }
        return vestingList;
    }

}
