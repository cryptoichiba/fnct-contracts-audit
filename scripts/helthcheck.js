const { ethers } = require('ethers');
const DEFAULT_RPC_URL = 'http://127.0.0.1:8545/';

async function main() {
  let rpc_url = DEFAULT_RPC_URL;
  if (process.argv.length > 2) {
    rpc_url = process.argv[2];
  }

  const provider = new ethers.providers.JsonRpcProvider(rpc_url);
  // getBlockNumber が成功すればチェーンは起動している
  await provider.getBlockNumber();
  return true;
}

main().catch((error) => {
  console.log(error);
  process.exitCode = 1;
});
