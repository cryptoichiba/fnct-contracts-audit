const fs = require('fs');
task('submit', 'submit hash of validators')
  .addOptionalParam('rng', 'RNG Contract address')
  .addOptionalParam('time', 'TimeContract address')
  .addOptionalParam('logFileHash', 'LogFileHash Contract address')
  .addParam('day', 'validator\'s submission day')
  .setAction(async (taskArgs) => {
    const {
      rng,
      time,
      logFileHash,
      day,
    } = taskArgs;

    if (day == null || day < 0) {
      throw new Error(`error: day should be not less than 0. (input:  ${day})`);
    }

    const accounts = await ethers.getSigners();
    const owner = accounts[0];
    const signerValidator1 = accounts[1];
    const signerValidator2 = accounts[2];
    const outputFile = `${__dirname}/../contract_address.json`;
    const json = fs.readFileSync(outputFile, 'utf8')
    const addresses = JSON.parse(json)

    const timeContract = await ethers.getContractAt('MockTimeContract', time || addresses.MockTimeContract, owner);
    const rngContract = await ethers.getContractAt('MockRandomNumberGenerator', rng || addresses.MockRandomNumberGenerator, owner);
    const logFileHashContract = await ethers.getContractAt('LogFileHash', logFileHash || addresses.LogFileHash, owner);

    const case1 = {
      0: [0, '0x00', '0x01'],
      1: [0, '0x00', '0x01'],
      2: [1, '0x01', '0x02'],
      3: [2, '0x02', '0x03'],
      180: [3, '0x03', '0x04'],
      181: [4, '0x04', '0x05'],
      182: [5, '0x05', '0x06'],
    }

    const case2 = {
      0: [0, '0x00', '0x01'],
      1: [1, '0x01', '0x02'],
      2: [2, '0x02', '0x03'],
      3: [3, '0x03', '0x04'],
      180: [4, '0x04', '0x05'],
      181: [5, '0x05', '0x06'],
      182: [6, '0x06', '0x07'],
    }

    await timeContract.connect(owner).setCurrentTimeIndex(day)
    await rngContract.connect(owner).setRandomNumber(day, 1); // validator1が勝つ
    await logFileHashContract.connect(signerValidator1).submit(case1[day][0], case1[day][1], case1[day][2]);
    await logFileHashContract.connect(signerValidator2).submit(case2[day][0], case2[day][1], case2[day][2]);
    await timeContract.connect(owner).setCurrentTimeIndex(0); // reset

    console.log(`ok: submit: ${day}`);
  });
