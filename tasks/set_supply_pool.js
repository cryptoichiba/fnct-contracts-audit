task("set_supply_pool", "set staking pool or cth pool")
  .addOptionalParam("owner", "owner address")
  .addFlag("staking", "choose staking pool")
  .addFlag("cth", "choose cth pool")
  .addParam("fnctAddress", "FNCToken address")
  .addParam("contractAddress", "RewardContract address")
  .addOptionalParam("startDay", "number of days. if you choose staking, it is required.")
  .addParam("poolSize", "pool size")
  .setAction(async (taskArgs) => {
    if (!taskArgs.staking && !taskArgs.cth) {
      throw new Error('error: You can choose either staking or cth.');
    }
    const owner = taskArgs.owner || (await ethers.getSigners())[0];
    const {
      fnctAddress,
      contractAddress,
      startDay,
      poolSize
    } = taskArgs;;
    if (taskArgs.staking && !startDay) {
      throw new Error('error: If you choose staking, start day is required.');
    }
    const allocateSize = ethers.utils.parseUnits(poolSize, 'ether');

    const fnct = await ethers.getContractAt('FNCToken', fnctAddress, owner);
    const contract = await ethers.getContractAt('RewardContract', contractAddress, owner);

    let sumOfPoolSize = ethers.utils.parseUnits('0', 'ether');
    if (taskArgs.staking) {
      sumOfPoolSize = sumOfPoolSize.add(allocateSize);
    }
    if (taskArgs.cth) {
      sumOfPoolSize = sumOfPoolSize.add(allocateSize);
    }
    const currentBalance = await fnct.connect(owner).balanceOf(owner.address);
    if (currentBalance.lt(sumOfPoolSize)) {
      await fnct.connect(owner).mint(owner.address, sumOfPoolSize);
    }
    await fnct.connect(owner).approve(contract.address, sumOfPoolSize);

    if (taskArgs.staking) {
      await contract.connect(owner).supplyStakingPool(startDay, allocateSize);
      console.log('ok: set supply staking pool');
    }
    if (taskArgs.cth) {
      await contract.connect(owner).supplyCTHPool(allocateSize);
      console.log('ok: set supply cth pool');
    }
  });
