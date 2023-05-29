const FncToken = artifacts.require('FNCToken');
const TimeContract = artifacts.require('TimeContract');
const StakingContract = artifacts.require('StakingContract');
const RewardContract = artifacts.require('RewardContract');
const ValidatorContract = artifacts.require('ValidatorContract');
const VaultContract = artifacts.require('VaultContract');

const Web3 = require('web3');
const fs = require('fs');
const web3 = new Web3('http://127.0.0.1:7545');

module.exports = async function () {
  // account 0をユーザーオーナー
  // account 1,2,3をバリデータ
  // account 4以降を一般ユーザーとする
  const accounts = await web3.eth.getAccounts();
  console.log(accounts)

  const fnct = await FncToken.deployed();
  const time = await TimeContract.deployed();
  const staking = await StakingContract.deployed();
  const reward = await RewardContract.deployed();
  const validator = await ValidatorContract.deployed();
  const vault = await VaultContract.deployed();

  // 報酬プール追加
  const currentIndex = await time.getCurrentTimeIndex();
  const amount = web3.utils.toWei('10');
  console.log(reward.address)
  await fnct.approve(reward.address, amount);
  const allow = await fnct.allowance(accounts[0], reward.address)
  console.log(allow.toString())
  console.log('e')
  await reward.trans();
  await reward.supplyStakingPool(currentIndex, amount);
  console.log('e')

  // バリデータ追加
  await staking.addValidatorToWhiteList(accounts[1]);
  await staking.addValidatorToWhiteList(accounts[2]);
  await staking.addValidatorToWhiteList(accounts[3]);
  console.log('validators:')
  console.log(await staking.getAllValidators());


  // バリデータのアドレスをRailsで使用するので一時ファイルに書き込む
  fs.writeFileSync('tmp/validators', accounts.slice(1,3).join('\n'))

  console.log('コントラクト側のダミー作成が完了しました')
}
