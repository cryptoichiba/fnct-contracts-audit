const { ethers } = require("hardhat");
const { constants } = require("@openzeppelin/test-helpers");
const { getOwnerSigner, genInstantSigner } = require("./utils");

const ZeroCTHRewardTransferTicket = {
  receiver: constants.ZERO_ADDRESS,
  accumulatedAmount: 0,
  ticketSigner: constants.ZERO_ADDRESS,
  metaSignature: "0x00",
  bodySignature: "0x00",
};

const createCTHRewardTransferTicket = async (
  receiver,
  amount, // BigNumber
  _metaSigner = null
) => {
  const metaSigner = _metaSigner || await getOwnerSigner();
  const { instantSigner } = genInstantSigner();

  const metaDataHash = ethers.utils.solidityKeccak256(["bytes"], [instantSigner.address]);
  const metaSignature = await metaSigner.signMessage(ethers.utils.arrayify(metaDataHash));

  const bodyHash = ethers.utils.solidityKeccak256(["bytes", "uint"], [receiver.address, amount]);
  const bodySignature = await instantSigner.signMessage(ethers.utils.arrayify(bodyHash));

  return {
    receiver: receiver.address,
    accumulatedAmount: amount,
    ticketSigner: instantSigner.address,
    metaSignature,
    bodySignature,
  };
};

const ZeroStakingRewardTransferTicket = {
  receiver: constants.ZERO_ADDRESS,
  amount: 0,
  ticketSigner: constants.ZERO_ADDRESS,
  metaSignature: "0x00",
  bodySignature: "0x00",
};

const createStakingRewardTransferTicket = async(
  receiver,
  amount, // BigNumber
  _metaSigner = null
) => {
  const metaSigner = _metaSigner || await getOwnerSigner();
  const { instantSigner } = genInstantSigner();

  const metaDataHash = ethers.utils.solidityKeccak256(["bytes"], [instantSigner.address]);
  const metaSignature = await metaSigner.signMessage(ethers.utils.arrayify(metaDataHash));

  const bodyHash = ethers.utils.solidityKeccak256(["bytes", "uint"], [receiver.address, amount]);
  const bodySignature = await instantSigner.signMessage(ethers.utils.arrayify(bodyHash));

  return {
    receiver: receiver.address,
    amount,
    ticketSigner: instantSigner.address,
    metaSignature,
    bodySignature,
  };
};

// ---

exports.ZeroCTHRewardTransferTicket = ZeroCTHRewardTransferTicket;
exports.createCTHRewardTransferTicket = createCTHRewardTransferTicket;
exports.ZeroStakingRewardTransferTicket = ZeroStakingRewardTransferTicket;
exports.createStakingRewardTransferTicket = createStakingRewardTransferTicket;
