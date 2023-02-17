# 環境構築
```shell
nodenv local 14.16.1
npm install
```

```shell
touch .secret
```

.secretに自分のウォレットの秘密鍵のフレーズをいれて保存する。

# Solidityのコンパイル
```
npx hardhat compile
```

# テストの実行
```
npx hardhat test
```

# Gas Report

テスト実行時にガス使用量のレポートを出力する場合は環境変数 `REPORT_GAS` を設定して実行する。

```shell
REPORT_GAS=1 npx hardhat test
```

参考: AさんからBさんにETHを送金する場合のガス使用量は `21,000` になる。

`gasReporterOutput.json` を出力する方法。

```shell
CI=true REPORT_GAS=1 npx hardhat test
```

`gasReporterOutput.json` を出力すると次のスクリプトを実行して内容をチェックできる。

 * check_gas_report.js
   * gasReporterOutput.jsonを解釈して、指定したガス使用量を超えたメソッドやデプロイをリスト表示する。
 * list_gas_usage_of_method.js
   * gasReporterOutput.jsonを解釈して、メソッドの情報をリスト表示する。
 * list_gas_usage_of_deployment.js
   * gasReporterOutput.jsonを解釈して、デプロイの情報をリスト表示する。

check_gas_report.jsの使用例

```shell
## 想定以上のガスを使用するものを見つける
$ node scripts/check_gas_report.js
--------------------------------------------------
List of methods that exceed gas usage: (gas-limit: 1000000)
--------------------------------------------------
(nothing)

--------------------------------------------------
List of deployments that exceed gas usage: (gas-limit: 2000000)
--------------------------------------------------
(nothing)


## リミットのガス使用量を指定できる (最終列がガス使用量の avg, その前の列が max)
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

list_gas_usage_of_method.jsとlist_gas_usage_of_deployment.jsの使用例

この2つのスクリプトは基本的に `gasReporterOutput.json` の内容を出力するだけです。
コマンドラインでパイプを組み合わせて使用するのを想定しています。

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

## ガス使用量の降順で表示する
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

