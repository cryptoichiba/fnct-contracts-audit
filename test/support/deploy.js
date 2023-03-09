const { ethers } = require('hardhat');
const { BigNumber } = ethers;

const MUMBAI_FNCT = '0xcc0A07053b7bfd69d72991Ad2e83c11f7838A9ad';
const POLYGON_ICBT = '0x0f93119bdac9e80ca845e9a56ae027507cb24c6a';

// Constants used in RNG Chainlink integration
const POINT_ONE_LINK = BigNumber.from("100000000000000000") // 0.1 LINK
const POINT_ZERO_ZERO_THREE_LINK = BigNumber.from("3000000000000000") // 0.003 LINK
const ONE_HUNDRED_LINK = BigNumber.from("100000000000000000000") // 100 LINK
const WEI_PER_UNIT_LINK = POINT_ZERO_ZERO_THREE_LINK

const getDefaultDeployer = async () => {
  const [firstAccount] = await ethers.getSigners();
  return firstAccount;
};

const deployTimeContract = async (timeUnit = 5, useMock = false, _deployer = null) => {
  const deployer = _deployer || await getDefaultDeployer();
  // Use RandomNumberGenerator only for qa / staging / proudction
  // const contractName = useMock ? 'MockTimeContract' : 'TimeContract';
  const contractName = 'MockTimeContract';
  const factory = await ethers.getContractFactory(contractName, deployer);
  const currentDt = new Date();
  const TimeContract = await factory.deploy(Math.floor(currentDt.getTime() / 1000), timeUnit);
  await TimeContract.deployed();

  return TimeContract;
};

const deployFNCToken = async (_deployer = null) => {
  const deployer = _deployer || await getDefaultDeployer();
  const FNCTokenFactory = await ethers.getContractFactory('FNCToken', deployer);
  const network = process.env.NETWORK

  let FNCToken
  if (network === 'mumbai') {
    FNCToken = await FNCTokenFactory.attach(MUMBAI_FNCT);
  } else if (network === 'polygon') {
    FNCToken = await FNCTokenFactory.attach(POLYGON_ICBT);
  } else {
    FNCToken = await FNCTokenFactory.deploy();
    await FNCToken.deployed();
  }

  return FNCToken;
};

const deployValidatorContract = async (_TimeContract, useMock = false, _deployer = null) => {
  const deployer = _deployer || await getDefaultDeployer();
  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);
  const contractName = useMock ? 'MockValidatorContract' : 'ValidatorContract';
  const factory = await ethers.getContractFactory(contractName, deployer);
  const ValidatorContract = await factory.deploy(TimeContract.address);
  await ValidatorContract.deployed();

  return ValidatorContract;
};

const deployVaultContract = async (
  _TimeContract = null,
  _FNCToken = null,
  useMock = false,
  _deployer = null
) => {
  const deployer = _deployer || await getDefaultDeployer();
  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);
  const FNCToken = _FNCToken || await deployFNCToken(deployer);
  const contractName = useMock ? 'MockVaultContract' : 'VaultContract';
  const factory = await ethers.getContractFactory(contractName, deployer);
  const VaultContract = await factory.deploy(TimeContract.address, FNCToken.address);
  await VaultContract.deployed();

  return VaultContract;
};

const deployStakingContract = async (
  _TimeContract = null,
  _FNCToken = null,
  _VaultContract = null,
  _ValidatorContract = null,
  useMock = false,
  _deployer = null
) => {
  const deployer = _deployer || await getDefaultDeployer();
  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);
  const FNCToken = _FNCToken || await deployFNCToken(deployer);
  const VaultContract = _VaultContract || await deployVaultContract(TimeContract, FNCToken, useMock, deployer);
  const ValidatorContract = _ValidatorContract || await deployValidatorContract(TimeContract, useMock, deployer);
  const contractName = useMock ? 'MockStakingContract' : 'StakingContract';
  const factory = await ethers.getContractFactory(contractName, deployer);
  const StakingContract = await factory.deploy(TimeContract.address, VaultContract.address, ValidatorContract.address);
  await StakingContract.deployed();

  return StakingContract;
};

const deployRNG = async (_TimeContract = null, useMock = false, _deployer = null) => {
  const deployer = _deployer || await getDefaultDeployer();

  // If creating mock contracts, can immediately create and return
  if (useMock) {
    const rngFactory = await ethers.getContractFactory('MockRandomNumberGenerator', deployer);
    const RNGContract = await rngFactory.deploy(
        "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", // Polygon Mainnet LINK token address (Mock ignores it though)
        "0x4e42f0adEB69203ef7AaA4B7c414e5b1331c14dc",  // Polygon Mainnet LINK VRF wrapper address (Mock ignores it though)
        40
    );
    await RNGContract.deployed();
    return RNGContract;
  }

  // TimeContract creation (if needed)
  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);

  // LinkToken creation
  const linkFactory = await ethers.getContractFactory('LinkToken', deployer)
  const LinkContract = await linkFactory.deploy()

  // VRFCoordinatorV2Mock creation
  const coordinatorFactory = await ethers.getContractFactory('VRFCoordinatorV2Mock', deployer)
  const CoordinatorContract = await coordinatorFactory.deploy(POINT_ONE_LINK, 1e9) // 0.000000001 LINK per gas

  // MockV3Aggregator creation
  const linkEthFeedFactory = await ethers.getContractFactory("MockV3Aggregator", deployer)
  const LinkEthFeedContract = await linkEthFeedFactory.deploy(18, WEI_PER_UNIT_LINK) // 1 LINK = 0.003 ETH

  // VRFV2Wrapper creation
  const wrapperFactory = await ethers.getContractFactory("VRFV2Wrapper", deployer)
  const WrapperContract = await wrapperFactory.deploy(LinkContract.address,
      LinkEthFeedContract.address, CoordinatorContract.address);

  // RandomNumberGenerator creation
  const rngFactory = await ethers.getContractFactory('RandomNumberGenerator', deployer);
  const RNGContract = await rngFactory.deploy(LinkContract.address, WrapperContract.address, 30, TimeContract.address);
  await RNGContract.deployed();

  // Fund RandomNumberGenerator with Link
  const fund = async (link, linkOwner, receiver, amount) => {
    await link.connect(linkOwner).transfer(receiver, amount)
  }
  await fund(LinkContract, deployer, RNGContract.address, ONE_HUNDRED_LINK)

  // For whatever reason, VRFCoordinatorV2Mock::fufillRandomWords also a subscription funded with Link, even though
  // test is using direct funding.  (Source code seems to confirm this - there doesn't seem to be any
  // direct funding pathway or alternate function - and Chainlink direct funding unit test example is indeed funding
  // a subscription)
  // Note: "1" is the wrapper's subscription id
  await CoordinatorContract.connect(deployer).fundSubscription(1, ONE_HUNDRED_LINK)

  return RNGContract;
};

const deployLogFileHash = async(
  _TimeContract,
  _StakingContract,
  _ValidatorContract,
  _RNG,
  useMock = false,
  _deployer = null
) => {
  const deployer = _deployer || await getDefaultDeployer();
  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);
  const StakingContract = _StakingContract;
  const ValidatorContract = _ValidatorContract || await deployValidatorContract(TimeContract, useMock, deployer);
  const RNG = _RNG || await deployRNG(TimeContract, useMock, deployer);

  const contractName = useMock ? 'MockLogFileHash' : 'LogFileHash';
  const factory = await ethers.getContractFactory(contractName, deployer);
  const LogFileHash = await factory.deploy(
    TimeContract.address,
    StakingContract.address,
    ValidatorContract.address,
    RNG.address,
    []
  );
  await LogFileHash.deployed();

  return LogFileHash;
};

const deployRewardContract = async (
  _TimeContract = null,
  _FNCToken = null,
  _StakingContract = null,
  _ValidatorContract = null,
  _VaultContract = null,
  _LogFileHash = null,
  useMock = false,
  _deployer = null
) => {
  const deployer = _deployer || await getDefaultDeployer();
  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);
  const FNCToken = _FNCToken || await deployFNCToken(deployer);
  const VaultContract = _VaultContract || await deployVaultContract(TimeContract, FNCToken, useMock, deployer);
  const ValidatorContract = _ValidatorContract || await deployValidatorContract(TimeContract, useMock, deployer);
  const StakingContract = _StakingContract || await deployStakingContract(
    TimeContract,
    FNCToken,
    VaultContract,
    ValidatorContract,
    useMock,
    deployer
  );
  const LogFileHash = _LogFileHash || await deployLogFileHash(TimeContract, useMock, deployer); // todo
  const contractName = useMock ? 'MockRewardContract' : 'RewardContract';
  const factory = await ethers.getContractFactory(contractName, deployer);
  const RewardContract = await factory.deploy(
    TimeContract.address,
    FNCToken.address,
    StakingContract.address,
    ValidatorContract.address,
    VaultContract.address,
    LogFileHash.address
  );
  await RewardContract.deployed();

  return RewardContract;
};

const deployAll = async (useMock = false, _deployer = null, preparedContracts = {}) => {
  const {
    _TimeContract,
    _FNCToken,
    _ValidatorContract,
    _VaultContract,
    _StakingContract,
    _LogFileHash,
    _RNG,
    _RewardContract,
  } = preparedContracts;

  const deployer = _deployer || await getDefaultDeployer();

  const TimeContract = _TimeContract || await deployTimeContract(5, useMock, deployer);
  const FNCToken = _FNCToken || await deployFNCToken(deployer);
  const ValidatorContract = _ValidatorContract || await deployValidatorContract(TimeContract, useMock, deployer);
  const VaultContract = _VaultContract || await deployVaultContract(
    TimeContract,
    FNCToken,
    useMock,
    deployer
  );
  const StakingContract = _StakingContract || await deployStakingContract(
    TimeContract,
    FNCToken,
    VaultContract,
    ValidatorContract,
    useMock,
    deployer
  );
  const RNG = _RNG || await deployRNG(TimeContract, useMock, deployer);
  const LogFileHash = _LogFileHash || await deployLogFileHash(
    TimeContract,
    StakingContract,
    ValidatorContract,
    RNG
  );
  const RewardContract = _RewardContract || await deployRewardContract(
    TimeContract,
    FNCToken,
    StakingContract,
    ValidatorContract,
    VaultContract,
    LogFileHash,
    useMock,
    deployer
  );

  return {
    TimeContract,
    FNCToken,
    ValidatorContract,
    VaultContract,
    StakingContract,
    RNG,
    LogFileHash,
    RewardContract,
  };
};

// ---

exports.deployTimeContract = deployTimeContract;
exports.deployFNCToken = deployFNCToken;
exports.deployValidatorContract = deployValidatorContract;
exports.deployVaultContract = deployVaultContract;
exports.deployStakingContract = deployStakingContract;
exports.deployRNG = deployRNG;
exports.deployLogFileHash = deployLogFileHash;;
exports.deployRewardContract = deployRewardContract;
exports.deployAll = deployAll;
