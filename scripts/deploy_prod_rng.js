const { ethers, network } = require("hardhat");

async function main() {
    console.log('start deploy');

    const TimeContractFactory = await ethers.getContractFactory('TimeContract');
    const RNGContractFactory = await ethers.getContractFactory('RandomNumberGenerator');

    //TimeContract deploy
    const unixTimestamp = Math.floor(new Date().getTime() / 1000 - 10);
    const timeContract = await TimeContractFactory.deploy(unixTimestamp, 3600 * 24);
    await timeContract.deployed();

    //RandomNumberGenerator deploy

    // We are using confirmations = 40.
    //
    // Given we're running on Polygon we're using Klaytn's 20 confirmations as a baseline.
    // ( https://klaytn.foundation/a-comparison-of-blockchain-network-latencies/ )
    // Then we're multiplying that by 2 for a large buffer.
    // Block times seem to be around 2 seconds each, so we expect 40 requestConfirmations
    // to produce a roughly 1.5 minute latency; this is within spec for the project.
    const rngFactory = await RNGContractFactory.deploy(
        "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", // Polygon Mainnet LINK token address
        "0x4e42f0adEB69203ef7AaA4B7c414e5b1331c14dc",  // Polygon Mainnet LINK VRF wrapper address
        40, //Block confirmations before Chainlink returns random number to RandomNumberGenerator
        timeContract.address
    );
    await rngFactory.deployed();

    console.log("Sleeping.....");
    // Wait for etherscan to notice that the contract has been deployed
    await new Promise(r => setTimeout(r, 30000));

    // Verify the contract after deploying
    await hre.run("verify:verify", {
        address: rngFactory.address,
        constructorArguments: [
            "0xb0897686c545045aFc77CF20eC7A532E3120E0F1", // Polygon Mainnet LINK token address
            "0x4e42f0adEB69203ef7AaA4B7c414e5b1331c14dc",  // Polygon Mainnet LINK VRF wrapper address
            40, //Block confirmations before Chainlink returns random number to RandomNumberGenerator
            timeContract.address
        ],
    });

    //Output addresses
    console.log(`TimeContract address: ${timeContract.address}`);
    console.log(`RandomNumberGenerator address: ${rngFactory.address}`);

    console.log('finished deploy');
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});