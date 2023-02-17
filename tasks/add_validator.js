task("add_validator", "add validator")
  .addOptionalParam("owner", "owner address")
  .addParam("contractAddress", "ValidatorContract address")
  .addParam("validator", "validator that to be address")
  .addParam("detail", "validator's detail hash")
  .addParam("rate", "validator's commision rate")
  .setAction(async (taskArgs) => {
    const owner = taskArgs.owner || (await ethers.getSigners())[0];
    const {
      contractAddress,
      validator,
      detail,
      rate,
    } = taskArgs;
    if (Number(rate) >= 1) {
      throw new Error(`error: Rate should be less than 1. (input:  ${rate})`);
    }

    const arrayfyshDetail = ethers.utils.arrayify(detail);
    // memo
    // コントラクト上の管理では 10 ** 6 -> 100%[=1] とされている
    // よって、 rate = 0.1[=10%] なら (0.1 * (10 ** 6)) と計算した値に直す
    const commissionRate = (Number(rate) * (10 ** 6));

    const contract = await ethers.getContractAt('ValidatorContract', contractAddress, owner);
    await contract.connect(owner).addValidator(validator, arrayfyshDetail, commissionRate);
    console.log(`ok: added validator: ${validator}`);
  });
