const {expect} = require('chai');
const {ethers} = require('hardhat');
const { deployLogFileHash, deployTimeContract, deployStakingContract, deployFNCToken, deployVaultContract,
  deployValidatorContract, deployRewardContract, deployRNG, WinnerStatus
} = require('./support/deploy');
const {
  createStakingRewardTransferTicket,
  createCTHRewardTransferTicket
} = require("./support/ticket");

describe('Maintain RewardContract', (_) => {
  let _FNCToken = null;
  let _TimeContract = null;
  let _RewardContract = null;
  let _StakingContract = null;
  let _VaultContract = null;
  let _ValidatorContract = null;
  let _LogFileHash = null;
  let _RNG = null, _ChainlinkWrapper = null, _ChainlinkCoordinator = null;
  let owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, newTicketSigner, poolMaintainer, signer, metaTransactionWorker, nobody;

  before(async () => {
    [owner, validator1, validator2, validator3, delegator1, delegator2, delegator3, newTicketSigner, poolMaintainer, signer, metaTransactionWorker, nobody] = await ethers.getSigners();
    _FNCToken = await deployFNCToken(owner);
    _TimeContract = await deployTimeContract(3600, true, owner);
    _VaultContract = await deployVaultContract(_TimeContract, _FNCToken, false, owner);
    _ValidatorContract = await deployValidatorContract(_TimeContract, false, owner);
    _StakingContract = await deployStakingContract(_TimeContract, _FNCToken, _VaultContract, _ValidatorContract, false, owner);
    [_RNG, _ChainlinkWrapper, _ChainlinkCoordinator] = await deployRNG(_TimeContract, true, owner);
    _LogFileHash = await deployLogFileHash(_TimeContract, _StakingContract, _ValidatorContract, _RNG, true, owner);
    _RewardContract = await deployRewardContract(_TimeContract, _FNCToken, _StakingContract, _ValidatorContract, _VaultContract, _LogFileHash, false, owner);

    // setup pool
    const allocateSize = web3.utils.toWei('10000').toString();
    await _FNCToken.connect(owner).approve(_RewardContract.address, allocateSize);
    await _RewardContract.connect(owner).supplyStakingPool(1, allocateSize);

    // setup validator
    await _ValidatorContract.connect(owner).addValidator(validator1.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator2.address, '0x00', 10 ** 5)
    await _ValidatorContract.connect(owner).addValidator(validator3.address, '0x00', 10 ** 5)
  })

  it('Success: Ticket signer', async () => {
    await expect(
      _RewardContract.connect(owner).setTicketSigner(newTicketSigner.address)
    ).to.be.emit(_RewardContract, "TicketSignerChanged").withArgs(owner.address, newTicketSigner.address);
  })

  it('Fail: Ticket signer is zero address', async () => {
    await expect(
      _RewardContract.connect(owner).setTicketSigner(ethers.constants.AddressZero)
    ).to.be.revertedWith("Reward: Signer is zero address");
  })

  it('Fail: non-owner', async () => {
    await expect(
      _RewardContract.connect(nobody).setTicketSigner(nobody.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  })

  it('Success: Pool maintainer/Staking', async () => {
    await _TimeContract.setCurrentTimeIndex(3);
    const allocateSize = web3.utils.toWei('10000').toString();
    await _FNCToken.connect(owner).mint(poolMaintainer.address, allocateSize);
    await _FNCToken.connect(poolMaintainer).approve(_RewardContract.address, allocateSize);

    // non-maintainer yet
    await expect(
      _RewardContract.connect(poolMaintainer).supplyStakingPool(10, allocateSize)
    ).to.be.reverted

    await expect(
      _RewardContract.connect(owner).grantPoolMaintainer(poolMaintainer.address)
    ).to.be.emit(_RewardContract, "PoolMaintainerGranted").withArgs(owner.address, poolMaintainer.address);

    await expect(
      _RewardContract.connect(poolMaintainer).supplyStakingPool(10, allocateSize)
    ).not.to.be.reverted

    await expect(
      _RewardContract.connect(owner).revokePoolMaintainer(poolMaintainer.address)
    ).to.be.emit(_RewardContract, "PoolMaintainerRevoked").withArgs(owner.address, poolMaintainer.address);
  })

  it('Success: Pool maintainer/CTH', async () => {
    const allocateSize = web3.utils.toWei('10000').toString();
    await _FNCToken.connect(owner).mint(poolMaintainer.address, allocateSize);
    await _FNCToken.connect(poolMaintainer).approve(_RewardContract.address, allocateSize);

    // non-maintainer yet
    await expect(
      _RewardContract.connect(poolMaintainer).supplyCTHPool(allocateSize)
    ).to.be.reverted

    await expect(
      _RewardContract.connect(owner).grantPoolMaintainer(poolMaintainer.address)
    ).to.be.emit(_RewardContract, "PoolMaintainerGranted").withArgs(owner.address, poolMaintainer.address);

    await expect(
      _RewardContract.connect(poolMaintainer).supplyCTHPool(allocateSize)
    ).not.to.be.reverted

    await expect(
      _RewardContract.connect(owner).revokePoolMaintainer(poolMaintainer.address)
    ).to.be.emit(_RewardContract, "PoolMaintainerRevoked").withArgs(owner.address, poolMaintainer.address);
  })

  it('Fail: Pool maintainer is zero address', async () => {
    await expect(
      _RewardContract.connect(owner).grantPoolMaintainer(ethers.constants.AddressZero)
    ).to.be.revertedWith("Reward: Maintainer is zero address");

    await expect(
      _RewardContract.connect(owner).revokePoolMaintainer(ethers.constants.AddressZero)
    ).to.be.revertedWith("Reward: Maintainer is zero address");
  })

  it('Fail: non-owner', async () => {
    await expect(
      _RewardContract.connect(nobody).grantPoolMaintainer(nobody.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      _RewardContract.connect(nobody).revokePoolMaintainer(nobody.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  })

  it('Success: Transaction worker/Staking', async () => {
    const ticketForStaking = await createStakingRewardTransferTicket(delegator1, 0, signer);
    const ticketForStaking2 = await createStakingRewardTransferTicket(delegator1, 0, signer);
    const ticketForCTH = await createCTHRewardTransferTicket(delegator1, 0, signer);
    const ticketForCTH2 = await createCTHRewardTransferTicket(delegator1, 0, signer);

    await expect(
      _RewardContract.connect(owner).setTicketSigner(signer.address)
    ).not.to.be.reverted;

    // non-worker yet
    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimStakingReward(ticketForStaking, 45)
    ).to.be.reverted

    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimCTHReward(ticketForCTH)
    ).to.be.reverted

    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimRewards({
        ticketForStaking: ticketForStaking,
        ticketForCTH: ticketForCTH
      }, 45)
    ).to.be.reverted

    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimRewardsWithList([], 45)
    ).to.be.reverted

    await expect(
      _RewardContract.connect(owner).grantMetaTransactionWorker(metaTransactionWorker.address)
    ).to.be.emit(_RewardContract, "MetaTransactionWorkerGranted").withArgs(owner.address, metaTransactionWorker.address);

    // become worker
    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimStakingReward(ticketForStaking, 45)
    ).not.to.be.reverted

    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimCTHReward(ticketForCTH)
    ).not.to.be.reverted

    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimRewards({
        ticketForStaking: ticketForStaking2,
        ticketForCTH: ticketForCTH2
      }, 45)
    ).not.to.be.reverted

    await expect(
      _RewardContract.connect(metaTransactionWorker).metaClaimRewardsWithList([], 45)
    ).not.to.be.reverted


    await expect(
      _RewardContract.connect(owner).revokeMetaTransactionWorker(metaTransactionWorker.address)
    ).to.be.emit(_RewardContract, "MetaTransactionWorkerRevoked").withArgs(owner.address, metaTransactionWorker.address);
  })

  it('Fail: Transaction worker is zero address', async () => {
    await expect(
      _RewardContract.connect(owner).grantMetaTransactionWorker(ethers.constants.AddressZero)
    ).to.be.revertedWith("Reward: Worker is zero address");

    await expect(
      _RewardContract.connect(owner).revokeMetaTransactionWorker(ethers.constants.AddressZero)
    ).to.be.revertedWith("Reward: Worker is zero address");
  })

  it('Fail: non-owner', async () => {
    await expect(
      _RewardContract.connect(nobody).grantMetaTransactionWorker(nobody.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");

    await expect(
      _RewardContract.connect(nobody).revokeMetaTransactionWorker(nobody.address)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  })

  it('Fail: Unrenounceable', async () => {
    await expect(
      _RewardContract.connect(owner).renounceOwnership()
    ).to.be.revertedWith("UnrenounceableOwnable: Can't renounce ownership");
  })
});
