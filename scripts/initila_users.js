const Web3 = require('web3');
const web3 = new Web3('http://127.0.0.1:7545');

module.exports = async function () {
  const accounts = await web3.eth.getAccounts();
  const document = `
  ローカルの環境で使用するアカウント一覧です。
  account 0をユーザーオーナー
  account 1,2,3をバリデータ
  account 4以降を一般ユーザーとします。
  `
  console.log(document)
  console.log(accounts)
  console.log('最初のアカウントの秘密鍵をganacheからコピーし、.secretのファイルに書いてください。')

}
