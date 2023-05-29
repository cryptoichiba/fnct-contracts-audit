// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./NonCustodialLockup.sol";
import "../staking/utils/UnrenounceableOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract FNCTLockupManager is UnrenounceableOwnable {

    address _fnct;
    address _reclaimWallet;

    struct LockupPair {
        address holder;
        address deployedContract;
    }

    mapping(address => address) private _lockupMap;
    LockupPair[] private _lockupList;

    constructor(
        address fnct_,
        address reclaimWallet_
    ) {
        require(fnct_ != address(0x0), "FNCTLockupManager: FNCT is zero address");
        require(reclaimWallet_ != address(0x0), "FNCTLockupManager: ReclaimWallet is zero address");

        _fnct = fnct_;
        _reclaimWallet = reclaimWallet_;
    }

    function deployLockup(
        address[] calldata targets
    ) external onlyOwner {
        require(targets.length > 0, "FNCTLockupManager: No targets");

        for ( uint i = 0; i < targets.length; i++ ) {
            if ( _lockupMap[targets[i]] == address(0x0) ) {
                address deployedContract = address(
                    new NonCustodialLockup(
                        _fnct,
                        targets[i],
                        _reclaimWallet
                    )
                );
                _lockupMap[targets[i]] = deployedContract;
                _lockupList.push(LockupPair(targets[i], deployedContract));
            }
        }
    }

    function setupStakingContracts(
        address stakingContract,
        address vaultContract,
        address rewardContract
    ) external onlyOwner {
        require(stakingContract != address(0x0), "FNCTLockupManager: StakingContract is zero address");
        require(vaultContract != address(0x0), "FNCTLockupManager: VaultContract is zero address");
        require(rewardContract != address(0x0), "FNCTLockupManager: RewardContract is zero address");

        for ( uint i = 0; i < _lockupList.length; i++ ) {
            NonCustodialLockup lockup = NonCustodialLockup(_lockupList[i].deployedContract);
            lockup.setupStakingContracts(stakingContract, vaultContract, rewardContract);
        }
    }

    function setupGovernanceContract(
        address governanceContract
    ) external onlyOwner {
        require(governanceContract != address(0x0), "FNCTLockupManager: GovernanceContract is zero address");

        for ( uint i = 0; i < _lockupList.length; i++ ) {
            NonCustodialLockup lockup = NonCustodialLockup(_lockupList[i].deployedContract);
            lockup.setupGovernanceContract(governanceContract);
        }
    }

    function allocateTokens(
        address[] calldata targets,
        uint[] calldata tokenAmounts
    ) external onlyOwner {
        require(targets.length > 0, "FNCTLockupManager: No targets");
        require(tokenAmounts.length > 0, "FNCTLockupManager: No tokenAmounts");
        require(targets.length == tokenAmounts.length, "FNCTLockupManager: Argument array length doesn't match");

        IERC20 fnct = IERC20(_fnct);
        for ( uint i = 0; i < targets.length; i++ ) {
            NonCustodialLockup lockup = NonCustodialLockup(_lockupMap[targets[i]]);
            SafeERC20.safeTransfer(fnct, address(lockup), tokenAmounts[i]);
        }
    }

    function lockupTokens(
        address[] calldata targets
    ) external onlyOwner {
        require(targets.length > 0, "FNCTLockupManager: No targets");

        IERC20 fnct = IERC20(_fnct);
        for ( uint i = 0; i < targets.length; i++ ) {
            NonCustodialLockup lockup = NonCustodialLockup(_lockupMap[targets[i]]);
            uint256 amount = fnct.balanceOf(address(lockup));
            lockup.lock(amount);
        }
    }

    function vestTokens(
        address[] calldata targets,
        uint[] calldata tokenAmounts
    ) external onlyOwner {
        require(targets.length > 0, "FNCTLockupManager: No targets");
        require(tokenAmounts.length > 0, "FNCTLockupManager: No tokenAmounts");
        require(targets.length == tokenAmounts.length, "FNCTLockupManager: Argument array length doesn't match");

        for ( uint i = 0; i < targets.length; i++ ) {
            NonCustodialLockup lockup = NonCustodialLockup(_lockupMap[targets[i]]);
            lockup.vestTokens(tokenAmounts[i]);
        }
    }

    function getDeployedContractCount() external view returns (uint) {
        return _lockupList.length;
    }

    function getDeployedContractList(uint start, uint count) external view returns (LockupPair[] memory) {
        require(start < _lockupList.length, "FNCTLockupManager: No targets");
        require(count > 0, "FNCTLockupManager: No targets");
        require(start + count <= _lockupList.length, "FNCTLockupManager: No targets");

        LockupPair[] memory lockupList = new LockupPair[](count);
        for ( uint i = 0; i < count && start + i < _lockupList.length; i++ ) {
            lockupList[i] = _lockupList[start + i];
        }
        return lockupList;
    }

}
