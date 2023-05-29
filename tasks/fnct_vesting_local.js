const fs = require('fs');

task("fnct-vesting-local:deploy-contracts", "deploy contracts that use for fnct-vesting")
  .setAction(async (taskArgs, hre) => {
    // compile をかけておく
    await hre.run("compile");

    console.log("start deploy");

    const { BigNumber } = ethers;

    const deploy = require("../test/support/deploy");
    const {
      deployFNCToken,
    } = deploy;

    const [
      owner,
      reclaimer,
      // stockholder
      stockholder1,
      stockholder2,
      stockholder3,
      // employee
      employee1,
      employee2,
      employee3,
    ] = await ethers.getSigners();

    const employees = [
      employee1,
      employee2,
      employee3,
    ];
    const employeeAddressList = employees.map(e => e.address);

    const stockholders = [
      stockholder1,
      stockholder2,
      stockholder3,
    ];
    const stockholderAddressList = stockholders.map(s => s.address);


    // -----
    // deploy contracts
    // -----
    const FNCToken = await deployFNCToken(owner);

    const LockupManagerFactory = await ethers.getContractFactory("FNCTLockupManager", owner);
    const LockupManager = await LockupManagerFactory.deploy(
      FNCToken.address,
      reclaimer.address
    );
    await LockupManager.deployed();

    const VestingManagerFactory = await ethers.getContractFactory("FNCTVestingManager", owner);
    const VestingManager = await VestingManagerFactory.deploy(
      FNCToken.address
    );
    await VestingManager.deployed();

    // -----
    // deploy NonCustodialLockup & NonCustodialVesting contracts
    // -----
    await LockupManager.deployLockup(employeeAddressList);
    await VestingManager.deployVesting(stockholderAddressList);

    // mint & allocate
    // lockup
    const employeeLockupAmountList = employees.map(() => ethers.utils.parseEther("15000"));
    const mintLockupAmount = employeeLockupAmountList.reduce((acc, value) => acc.add(value), BigNumber.from("0"));

    await FNCToken.mint(LockupManager.address, mintLockupAmount);
    await LockupManager.allocateTokens(employeeAddressList, employeeLockupAmountList);

    // vesting
    const stockHolderVestingAmountList = stockholders.map(() => ethers.utils.parseEther("20000"));
    const mintVestingAmount = stockHolderVestingAmountList.reduce((acc, value) => acc.add(value), BigNumber.from("0"));

    await FNCToken.mint(VestingManager.address, mintVestingAmount);
    await VestingManager.allocateTokens(stockholderAddressList, stockHolderVestingAmountList);

    // info
    const info = {};
    info["owner"] = owner.address;
    info["reclaimer"] = reclaimer.address;
    info["stockholders"] = stockholderAddressList
    info["employees"] = employeeAddressList
    info["FNCToken"] = FNCToken.address;
    info["LockupManager"] = LockupManager.address;
    info["VestingManager"] = VestingManager.address;
    console.log(info);

    const content = JSON.stringify(info);
    const outputFile = `${__dirname}/../fnct_vesting_local.json`;
    fs.writeFileSync(outputFile, content, "utf8", err => {
      if (err) {
        throw err;
      }
    });
    console.log("finished deploy");
  });
