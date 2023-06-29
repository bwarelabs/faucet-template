const { BigNumber } = require("ethers");
const { attachToContract, getTxStatus, ONE_TOKEN_UNITS,toBytesRole } = require("./utility/tools");

module.exports = {
    deployFaucet: async function (normalTokens, twitterTokens, cooldownPeriod, dailyLimit) {
        const [deployer] = await ethers.getSigners();
        console.log(`Deployer of faucet contract: ${deployer.address}`);
        console.log(`Deployer balance: ${await deployer.getBalance()}`);

        const Faucet = await ethers.getContractFactory('Faucet');
        const faucet = await upgrades.deployProxy(Faucet, [deployer.address, normalTokens, twitterTokens, cooldownPeriod,dailyLimit]);
        console.log(`Deploy staking transaction hash: ${faucet.deployTransaction.hash}`);
        await faucet.deployed();

        return faucet.address;
    },
    upgradeFaucet: async function (contract) {
        const [deployer] = await ethers.getSigners();
        console.log(`Upgrader of faucet contract: ${deployer.address}`);
        console.log(`Upgrader balance: ${await deployer.getBalance()}`);
        console.log(`Previous implementation contract: ${await upgrades.erc1967.getImplementationAddress(contract)}`);

        const Faucet = await ethers.getContractFactory('Faucet');
        const tx = await upgrades.prepareUpgrade(contract, Faucet, {
            getTxResponse: true
        });
        console.log(`Deploy new implementation contract at transaction of hash: ${tx.hash}\n`);
        await tx.wait();

        const faucet = await upgrades.upgradeProxy(contract, Faucet);
        console.log(`Link new implementation contract at transaction of hash: ${faucet.deployTransaction.hash}`);
        await faucet.deployed();
        console.log(`Current implementation contract: ${await upgrades.erc1967.getImplementationAddress(contract)}`);
    },
    requestTokens: async function (contract, userAccount, requestType) {
        const faucet = await attachToContract('Faucet', contract);
        const tx = await faucet.requestTokens(userAccount,requestType);
        return await getTxStatus(arguments, tx);
    },
    setNormalRequestTokens: async function (contract, normalRequestTokensAmount) {
        const faucet = await attachToContract('Faucet', contract);
        const tx = await faucet.setNormalRequestTokens(normalRequestTokensAmount);
        return await getTxStatus(arguments, tx);
    },
    setTwitterRequestTokens: async function (contract, twitterRequestTokensAmount) {
        const faucet = await attachToContract('Faucet', contract);
        const tx = await faucet.setTwitterRequestTokens(twitterRequestTokensAmount);
        return await getTxStatus(arguments, tx);
    },
    setCooldownPeriod: async function (contract, cooldownPeriod) {
        const faucet = await attachToContract('Faucet', contract);
        const tx = await faucet.setCooldownPeriod(cooldownPeriod);
        return await getTxStatus(arguments, tx);
    },
    setDailyLimit: async function (contract, dailyLimit) {
        const faucet = await attachToContract('Faucet', contract);
        const tx = await faucet.setDailyLimit(dailyLimit);
        return await getTxStatus(arguments, tx);
    },
    transferAllFunds: async function (contract, ownerAddress) {
        const faucet = await attachToContract('Faucet', contract);
        const tx = await faucet.transferAllFunds(ownerAddress);
        return await getTxStatus(arguments, tx);
    },
    grantRole: async function (contract, role, account) {
        const accessControl = await attachToContract('AccessControlUpgradeable', contract);
        const tx = await accessControl.grantRole(toBytesRole(role), account);
        return await getTxStatus(arguments, tx);
    },
    pause: async function (contract) {
        const pausable = await attachToContract('Faucet', contract);
        const tx = await pausable.pause();
        return await getTxStatus(arguments, tx);
    },

    unpause: async function (contract) {
        const pausable = await attachToContract('Faucet', contract);
        const tx = await pausable.unpause();
        return await getTxStatus(arguments, tx);
    }
}
