## Overview

This repository contains FNCT functionality smart contracts.

Whitepaper: https://fnct-whitepaper.gitbook.io/en/

### Staking

FNCT's staking system.

#### Background
1) Financie stores transaction records in IPFS file storage ( https://ipfs.financie.jp )
2) Every week, a hash of this data is generated (available from https://financie.jp/api/fnct/ipfs_upload_hash/[day_index] )
3) The staking/validation system saves this hash to the Polygon chain
4) Our goal is to make transactions in FiNANCiE auditable and immutable through the IPFS storage and the smart contract on the Polygon chain

#### Flow
1) "Validators" submit IPFS hashes to LogFileHash contract
2) "Delegators" stake locked FNCT to ("vote for") these validators
3) The hash with 50%+ voting power is deemed "correct" and saved to chain
4) "Validators" get a commission, and separately a single winning validator is chosen each day;
"Delegators" staked to this validator receive rewards

#### Contracts
- staking/Staking.sol: Handles locking & delegating (staking)
- staking/LogFileHash.sol: Handle IPFS hash submission and "winner" determination
- staking/Reward.sol: Reward pool and reward transfer management
- staking/Validator.sol: Validator management
- staking/Vault.sol: Locked FNCT management
- staking/Time.sol: (Utility) Time management (Can set length of "day" in constructor for debug purposes)
- staking/RNG.sol: (Utility) RNG management (Interfacing with Chainlink)

## Test

### Build environment
```shell
nodenv local 14.16.1
npm install
```

```shell
touch .secret
```

Save your wallet's private key phrase in .secret file.

### Compile Solidity
```
npx hardhat compile
```

### Run the test
```
npx hardhat test
```

### Gas Report

To output a report of gas usage when the test is run, set the environment variable `REPORT_GAS` and run the test.

```shell
REPORT_GAS=1 npx hardhat test
```

Note: The amount of gas used in the case of transferring ETH from A to B is `21,000`.

Output `gasReporterOutput.json` with:

```shell
CI=true REPORT_GAS=1 npx hardhat test
```

Once you have ``gasReporterOutput.json``, you can run the following script to check the contents.

 * check_gas_report.js
   * interpret ``gasReporterOutput.json`` and list methods and deployments that exceed the specified gas usage.
 * list_gas_usage_of_method.js
   * Interpret gasReporterOutput.json and list method information.
 * list_gas_usage_of_deployment.js
   * Interpret gasReporterOutput.json and list information of deployment.

Example usage of check_gas_report.js:

```shell
## Find one that uses more gas than expected
$ node scripts/check_gas_report.js
--------------------------------------------------
List of methods that exceed gas usage: (gas-limit: 1000000)
--------------------------------------------------
(nothing)

--------------------------------------------------
List of deployments that exceed gas usage: (gas-limit: 2000000)
--------------------------------------------------
(nothing)


## You can specify a limit for gas usage (last column is avg of gas usage, previous column is max)
$ node scripts/check_gas_report.js --method-limit-gas 21000 --deployment-limit-gas 50000
--------------------------------------------------
List of methods that exceed gas usage: (gas-limit: 21000)
--------------------------------------------------
FNCToken|approve|approve(address,uint256)|46303|46293
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|145558|134779
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|90473|80060

--------------------------------------------------
List of deployments that exceed gas usage: (gas-limit: 50000)
--------------------------------------------------
FNCToken|809736|809736
RandomNumberGenerator|952457|952457
RewardContract|1842028|1842024
StakingContract|971071|971069
TimeContract|154587|154587
ValidatorContract|502291|502291
VaultContract|206996|206992
```

Example usage of list_gas_usage_of_method.js and list_gas_usage_of_deployment.js:

These two scripts basically just output the contents of `gasReporterOutput.json`.
They are intended to be used in combination with a pipe on the command line.

```shell
$ node scripts/list_gas_usage_of_method.js | uniq
FNCToken|approve|approve(address,uint256)|46279
FNCToken|approve|approve(address,uint256)|46291
FNCToken|approve|approve(address,uint256)|46303
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|115278
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|143502
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|145558
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|73361
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|73373
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|90473

## Display gas usage in descending order
$ node scripts/list_gas_usage_of_method.js | uniq | sort -k 4 -t '|' -r
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|90473
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|73373
StakingContract|addValidatorToWhiteList|addValidatorToWhiteList(address)|73361
FNCToken|approve|approve(address,uint256)|46303
FNCToken|approve|approve(address,uint256)|46291
FNCToken|approve|approve(address,uint256)|46279
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|145558
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|143502
RewardContract|addTokensToPool|addTokensToPool(uint256,uint256)|115278
```

## License

FNCT contracts are distributed under MIT License.