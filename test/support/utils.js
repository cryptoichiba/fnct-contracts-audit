const { ethers } = require("hardhat");
const { v4: uuidv4 } = require("uuid");

const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const genHexUUID = () => "0x" + uuidv4().replaceAll("-", "");

const getOwnerSigner = async () => {
  // first signer is default owner.
  const [owner] = await ethers.getSigners();
  return owner;
};

const genInstantSigner = (_provider = null) => {
  const provider = _provider || ethers.getDefaultProvider();
  const instantPrivateKey = ethers.utils.solidityKeccak256(["bytes"], [genHexUUID()]);
  const instantSigner = new ethers.Wallet(instantPrivateKey, provider);

  return {
    instantSigner,
    instantPrivateKey,
  };
};

const genUsers = async (num, suppliyer, supply=0) => {
  const provider = ethers.provider;
  const users = [];
  for (let i = 0; i < num; i++) {
    const { instantSigner } = await genInstantSigner(provider);
    users.push(instantSigner);
  }

  const totalSupply = await suppliyer.getBalance();
  let amountPerUser;
  if ( supply == 0 ) {
    amountPerUser = totalSupply.div(ethers.BigNumber.from(num + 1));
  } else {
    amountPerUser = supply;
  }

  for (let i = 0; i < users.length; i++) {
    await suppliyer.sendTransaction({
      to: users[i].address,
      value: amountPerUser,
    });
  }

  return users;
};

const sample = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

// ---

exports.sleep = sleep;
exports.genHexUUID = genHexUUID;
exports.getOwnerSigner = getOwnerSigner;
exports.genInstantSigner = genInstantSigner;
exports.genInstantSigner = genInstantSigner;
exports.genUsers = genUsers;
exports.sample = sample;
