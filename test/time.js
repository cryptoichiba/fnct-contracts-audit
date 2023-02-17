const { expect } = require("chai");
const { ethers, network } = require("hardhat");

// In hardhat EVM, each transaction will count up block.timestamp.
// So this unit test should be executed without other tests
describe.skip('TimeContract', () => {
  const unixTimestamp = Math.floor(new Date().getTime() / 1000);

  it("Today(Now)", async () => {
    const TimeContract = await ethers.getContractFactory('TimeContract');
    const _TimeContract = await TimeContract.deploy(unixTimestamp - 10, 3600 * 24);
    await _TimeContract.deployed();
    await expect(
      await _TimeContract.getCurrentTimeIndex()
    ).to.be.equal(0);
  })

  it("Still Today(18H)", async () => {
    const TimeContract = await ethers.getContractFactory('TimeContract');
    const _TimeContract = await TimeContract.deploy(unixTimestamp - 3600 * 18, 3600 * 24);
    await _TimeContract.deployed();
    await expect(
      await _TimeContract.getCurrentTimeIndex()
    ).to.be.equal(0);
  })

  it("Still Today(24H - 10sec)", async () => {
    const TimeContract = await ethers.getContractFactory('TimeContract');
    const _TimeContract = await TimeContract.deploy(unixTimestamp - 3600 * 24 + 10, 3600 * 24);
    await _TimeContract.deployed();
    await expect(
      await _TimeContract.getCurrentTimeIndex()
    ).to.be.equal(0);
  })

  it("Yesterday(-24H + 10sec)", async () => {
    const TimeContract = await ethers.getContractFactory('TimeContract');
    const _TimeContract = await TimeContract.deploy(unixTimestamp - 3600 * 24 - 10,  3600 * 24);
    await _TimeContract.deployed();
    await expect(
      await _TimeContract.getCurrentTimeIndex()
    ).to.be.equal(1);
  })

  it("Fail: Too further date", async () => {
    // Over one week(=3600 * 24 * 7 sec)
    const TimeContract = await ethers.getContractFactory('TimeContract');
    await expect(
        TimeContract.deploy(unixTimestamp + 3600 * 24 * 7 + 10, 3600 * 24)
    ).to.be.reverted;
  })

  it("Fail: Too past date", async () => {
    // Over one week(=3600 * 24 * 7 sec)
    const TimeContract = await ethers.getContractFactory('TimeContract');
    await expect(
        TimeContract.deploy(unixTimestamp - 3600 * 24 * 7 - 10, 3600 * 24)
    ).to.be.reverted;
  })
});
