const fs = require('fs');

const POLYGON_ICBT = '0x0f93119bdac9e80ca845e9a56ae027507cb24c6a';
const MUMBAI_NAS = '0x48f4e4bF3fddBb381c591440910C83b8513D5911';

const getDeployer = async () => {
  if (process.env.DEPLOYER_PRIVATE_KEY) {
    const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY);
    return deployer;
  } else {
    const [firstAccount] = await ethers.getSigners();
    return firstAccount;
  }
};

const deployFNCToken = async (deployer, network) => {
  const FNCTokenFactory = await ethers.getContractFactory('FNCToken', deployer);

  let FNCToken
  if (network === 'polygon') {
    FNCToken = await FNCTokenFactory.attach(POLYGON_ICBT);
  } else if (network === 'mumbai') {
    FNCToken = await FNCTokenFactory.attach(MUMBAI_NAS);
  } else {
    FNCToken = await FNCTokenFactory.deploy();
    await FNCToken.deployed();
  }
  return FNCToken;
};

const deployTimeContract = async (unixTimestamp, deployer) => {
  const TimeContractFactory = await ethers.getContractFactory('TimeContract', deployer);
  const TimeContract = await TimeContractFactory.deploy(unixTimestamp, 3600); // For test purposes 1 day == 1 hour (3600 sec)
  await TimeContract.deployed();
  return TimeContract;
};

const deployRandomNumberGenerator = async (timeContract, deployer) => {
  const RandomNumberGeneratorFactory = await ethers.getContractFactory('RandomNumberGenerator', deployer);
  const RandomNumberGenerator = await RandomNumberGeneratorFactory.deploy(
      "0x326C977E6efc84E512bB9C30f76E30c160eD06FB", // For test purposes, Mumbai LINK token address
      "0x99aFAf084eBA697E584501b8Ed2c0B37Dd136693",  // For test purposes, Mumbai LINK VRF wrapper address
      30,
      timeContract.address,
  );
  await RandomNumberGenerator.deployed();
  return RandomNumberGenerator;
};

const deploy = async (FNCToken, TimeContract, RandomNumberGenerator, deployer) => {
  const LogFileHashFactory = await ethers.getContractFactory('LogFileHash', deployer);
  const ValidatorContractFactory = await ethers.getContractFactory('ValidatorContract', deployer);
  const StakingContractFactory = await ethers.getContractFactory('StakingContract', deployer);
  const RewardContractFactory = await ethers.getContractFactory('RewardContract', deployer);
  const VaultContractFactory = await ethers.getContractFactory('VaultContract', deployer);

  const ValidatorContract = await ValidatorContractFactory.deploy(TimeContract.address);
  await ValidatorContract.deployed();

  const VaultContract = await VaultContractFactory.deploy(
    TimeContract.address,
    FNCToken.address,
  );
  await VaultContract.deployed();

  const StakingContract = await StakingContractFactory.deploy(
    TimeContract.address,
    VaultContract.address,
    ValidatorContract.address,
  );
  await StakingContract.deployed();
  await VaultContract.setupStakingRole(StakingContract.address);

  const LogFileHash = await LogFileHashFactory.deploy(
    TimeContract.address,
    StakingContract.address,
    ValidatorContract.address,
    RandomNumberGenerator.address,
    []
  );
  await LogFileHash.deployed();

  const RewardContract = await RewardContractFactory.deploy(
    TimeContract.address,
    FNCToken.address,
    StakingContract.address,
    ValidatorContract.address,
    VaultContract.address,
    LogFileHash.address,
  );
  await RewardContract.deployed();
  return {ValidatorContract, VaultContract, StakingContract, LogFileHash, RewardContract};
};

const deployMock = async (unixTimestamp, deployer) => {
  const MockTimeContractFactory = await ethers.getContractFactory('MockTimeContract', deployer);
  const MockValidatorContractFactory = await ethers.getContractFactory('MockValidatorContract', deployer);
  const MockStakingContractFactory = await ethers.getContractFactory('MockStakingContract', deployer);
  const MockRewardContractFactory = await ethers.getContractFactory('MockRewardContract', deployer);
  const MockVaultContractFactory = await ethers.getContractFactory('MockVaultContract', deployer);
  const MockRandomNumberGeneratorFactory = await ethers.getContractFactory('MockRandomNumberGenerator', deployer);
  const MockLogFileHashFactory = await ethers.getContractFactory('MockLogFileHash', deployer);

  const MockTimeContract = await MockTimeContractFactory.deploy(unixTimestamp, 3600);
  await MockTimeContract.deployed();

  const MockValidatorContract = await MockValidatorContractFactory.deploy();
  await MockValidatorContract.deployed();

  const MockStakingContract = await MockStakingContractFactory.deploy();
  await MockStakingContract.deployed();

  const MockRewardContract = await MockRewardContractFactory.deploy(MockStakingContract.address);
  await MockRewardContract.deployed();

  const MockVaultContract = await MockVaultContractFactory.deploy();
  await MockVaultContract.deployed();

  const MockRandomNumberGenerator = await MockRandomNumberGeneratorFactory.deploy(
    "0x326C977E6efc84E512bB9C30f76E30c160eD06FB", // For test purposes, Mumbai LINK token address
    "0x99aFAf084eBA697E584501b8Ed2c0B37Dd136693",  // For test purposes, Mumbai LINK VRF wrapper address
    30
  );
  await MockRandomNumberGenerator.deployed();

  const MockLogFileHash = await MockLogFileHashFactory.deploy(
    MockTimeContract.address,
    MockStakingContract.address,
    MockValidatorContract.address,
    MockRandomNumberGenerator.address,
  );
  await MockLogFileHash.deployed();

  return {MockTimeContract, MockValidatorContract, MockStakingContract, MockRewardContract, MockVaultContract, MockRandomNumberGenerator, MockLogFileHash};
};

async function deployAll(network, testContract = false) {
  console.log('start deploy');
  const deployer = await getDeployer();
  const unixTimestamp = Math.floor(new Date().getTime() / 1000);

  const {
    MockTimeContract,
    MockValidatorContract,
    MockStakingContract,
    MockRewardContract,
    MockVaultContract,
    MockRandomNumberGenerator,
    MockLogFileHash
  } = await deployMock(unixTimestamp, deployer);

  const FNCToken = await deployFNCToken(deployer, network);
  const TimeContract = await deployTimeContract(unixTimestamp, deployer);
  let RandomNumberGenerator;
  let contracts;

  if (testContract) {
    RandomNumberGenerator = await deployRandomNumberGenerator(TimeContract, deployer);
    contracts = await deploy(FNCToken, MockTimeContract, MockRandomNumberGenerator, deployer);
  } else {
    RandomNumberGenerator = await deployRandomNumberGenerator(MockTimeContract, deployer);
    contracts = await deploy(FNCToken, TimeContract, RandomNumberGenerator, deployer);
  }

  const {
    ValidatorContract,
    VaultContract,
    StakingContract,
    LogFileHash,
    RewardContract
  } = contracts;


  console.log('--------------------------------------------------');
  console.log(`FNCToken address: ${FNCToken.address}`);
  console.log(`RandomNumberGenerator address: ${RandomNumberGenerator.address}`);
  console.log(`MockTimeContract address: ${MockTimeContract.address}`);
  console.log(`MockValidatorContract address: ${MockValidatorContract.address}`);
  console.log(`MockStakingContract address: ${MockStakingContract.address}`);
  console.log(`MockRewardContract address: ${MockRewardContract.address}`);
  console.log(`MockVaultContract address: ${MockVaultContract.address}`);
  console.log(`MockRandomNumberGenerator address: ${MockRandomNumberGenerator.address}`);
  console.log(`MockLogFileHash address: ${MockLogFileHash.address}`);
  console.log(`TimeContract address: ${TimeContract.address}`);
  console.log(`ValidatorContract address: ${ValidatorContract.address}`);
  console.log(`StakingContract address: ${StakingContract.address}`);
  console.log(`LogFileHash address: ${LogFileHash.address}`);
  console.log(`RewardContract address: ${RewardContract.address}`);
  console.log(`VaultContract address: ${VaultContract.address}`);
  console.log('--------------------------------------------------');

  addressMap = {
    TimeContract: TimeContract.address,
    FNCToken: FNCToken.address,
    RandomNumberGenerator: RandomNumberGenerator.address,
    LogFileHash: LogFileHash.address,
    ValidatorContract: ValidatorContract.address,
    StakingContract: StakingContract.address,
    RewardContract: RewardContract.address,
    VaultContract: VaultContract.address,
    MockTimeContract: MockTimeContract.address,
    MockValidatorContract: MockValidatorContract.address,
    MockStakingContract: MockStakingContract.address,
    MockRewardContract: MockRewardContract.address,
    MockVaultContract: MockVaultContract.address,
    MockRandomNumberGenerator: MockRandomNumberGenerator.address,
    MockLogFileHash: MockLogFileHash.address,
  };
  const content = JSON.stringify(addressMap);
  const outputFile = `${__dirname}/../contract_address.json`;
  fs.writeFileSync(outputFile, content, 'utf8', err => {
    if (err) {
      throw err;
    }
  });

  console.log('finished deploy');
}

task("deploy", "deploy all contracts")
  .addOptionalParam("owner", "owner address")
  .addFlag("testContract", "true if use MockTime and MockRNG")
  .setAction(async (taskArgs, env) => {
    const { testContract } = taskArgs;

    await deployAll(env.network.name, testContract)
  });
