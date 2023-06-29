const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { BigNumber } = require("ethers");
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");

describe("Faucet UTs", function () {

    let token;
    let owner, other, members;
    let faucet;

    const TOKEN_UNITS = BigNumber.from(10).pow(18);
    const NORMAL_TOKENS = TOKEN_UNITS.mul(1);
    const TWITTER_TOKENS = TOKEN_UNITS.mul(3);
    const DAILY_LIMIT = TOKEN_UNITS.mul(8);
    const COOLDOWN_PERIOD = 240;
    const MEMBER_COUNT = 10;
    const INITIAL_SUPPLY = TOKEN_UNITS.mul(1000);
    const SECONDS_PER_DAY = 24 * 60 * 60;

    const RequestType = {
        NORMAL_REQUEST: 0,
        TWITTER_REQUEST: 1
    }
    const NORMAL_REQUEST = 0;
    const TWITTER_REQUEST = 1;
    
    const ContractErrors = {
        ALREADY_REQUESTED: 0,
        HAS_TWEETED: 1,
        DAILY_LIMIT_REACHED: 2,
        OUT_OF_FUNDS: 3
    }

    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const ownerRole = keccak256(toUtf8Bytes("OWNER_ROLE"));
    const senderRole = keccak256(toUtf8Bytes("SENDER_ROLE"));

    async function getLastBlockTimestamp() {
        const blockNumber = await ethers.provider.getBlockNumber();
        const block = await ethers.provider.getBlock(blockNumber);
        return block.timestamp;
    }

    async function advanceTimeSeconds(seconds) {
        await ethers.provider.send("evm_mine", [(await ethers.provider.getBlock()).timestamp + 1 + seconds]);
    }
    before(async function () {
    });

    async function fundContract(contract, amount, token) {
        await token.connect(owner).transfer(contract.address, amount);
    }
    async function sendEth(from, to, amount) {
        const provider = ethers.provider;
        const signer = provider.getSigner(from);
        const tx = await signer.sendTransaction({
            to: to,
            value: ethers.utils.parseEther(amount)
        });
    }

    beforeEach(async function () {

        [owner, other, sender, founderAccount, ...members] = await ethers.getSigners();
        members = members.slice(0, MEMBER_COUNT);
        userWalletOne = members[0];
        userWalletTwo = members[1];


        const Faucet = await ethers.getContractFactory('Faucet');
        faucet = await upgrades.deployProxy(Faucet, [owner.address, NORMAL_TOKENS, TWITTER_TOKENS, COOLDOWN_PERIOD, DAILY_LIMIT]);

        await sendEth(founderAccount.address, faucet.address, '1000');
        await expect(faucet.initialize(owner.address, NORMAL_TOKENS, TWITTER_TOKENS, COOLDOWN_PERIOD, DAILY_LIMIT)).to.be.revertedWith(`Initializable: contract is already initialized`);

        await expect(fundContract(faucet, INITIAL_SUPPLY, token)).to.not.be.reverted;
        expect(await faucet.paused()).to.equal(true);
        expect(await ethers.provider.getBalance(faucet.address)).is.equal(INITIAL_SUPPLY);
        expect(await faucet.twitterRequestTokens()).is.equal(TWITTER_TOKENS);
        expect(await faucet.normalRequestTokens()).is.equal(NORMAL_TOKENS);
        expect(await faucet.cooldownPeriod()).is.equal(COOLDOWN_PERIOD);
        expect(await faucet.dailyLimit()).is.equal(DAILY_LIMIT);
        expect(await faucet.todaySpent()).is.equal(0);
        expect(await faucet.hasRole(ownerRole, owner.address)).is.equal(true);
        expect(await faucet.getRoleAdmin(ownerRole)).is.equal(ownerRole);
        expect(await faucet.getRoleAdmin(senderRole)).is.equal(ownerRole);

    });

    it("Test - config faucet", async function () {
        await expect(faucet.connect(other).setNormalRequestTokens(NORMAL_TOKENS)).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);
        await expect(faucet.connect(other).setTwitterRequestTokens(TWITTER_TOKENS)).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);
        await expect(faucet.connect(other).setCooldownPeriod(COOLDOWN_PERIOD)).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);
        await expect(faucet.connect(other).setDailyLimit(TWITTER_TOKENS)).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);

        await expect(faucet.connect(owner).setNormalRequestTokens(0)).to.be.revertedWith("Normal request amount to be transferred can not be 0");
        await expect(faucet.connect(owner).setTwitterRequestTokens(0)).to.be.revertedWith("Twitter request amount to be transferred can not be 0");
        await expect(faucet.connect(owner).setCooldownPeriod(0)).to.be.revertedWith("Cooldown period can not be 0");
        await expect(faucet.connect(owner).setDailyLimit(0)).to.be.revertedWith("Daily limit  can not be 0");

        let NEW_NORMAL_TOKENS = TOKEN_UNITS.mul(2);
        let NEW_TWITTER_TOKENS = TOKEN_UNITS.mul(4);
        let NEW_DAILY_LIMIT = TOKEN_UNITS.mul(10);
        let NEW_COOLDOWN_PERIOD = 300;

        await expect(faucet.connect(owner).setNormalRequestTokens(NEW_NORMAL_TOKENS)).to.not.be.reverted;
        await expect(faucet.connect(owner).setTwitterRequestTokens(NEW_TWITTER_TOKENS)).to.not.be.reverted;
        await expect(faucet.connect(owner).setCooldownPeriod(NEW_COOLDOWN_PERIOD)).to.not.be.reverted;
        await expect(faucet.connect(owner).setDailyLimit(NEW_DAILY_LIMIT)).to.not.be.reverted;

        expect(await faucet.normalRequestTokens()).is.equal(NEW_NORMAL_TOKENS);
        expect(await faucet.twitterRequestTokens()).is.equal(NEW_TWITTER_TOKENS);
        expect(await faucet.cooldownPeriod()).is.equal(NEW_COOLDOWN_PERIOD);
        expect(await faucet.dailyLimit()).is.equal(NEW_DAILY_LIMIT);

    });


    it("Test - request tokens", async function () {
        await expect(faucet.connect(other).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.be.revertedWith('Pausable: paused');
        await expect(faucet.connect(other).unpause()).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);
        await expect(faucet.connect(owner).unpause()).to.not.be.reverted;
        await expect(faucet.connect(other).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${senderRole}`);

        await expect(faucet.grantRole(senderRole, sender.address)).to.not.be.reverted;

        //request token from zero address;
        await expect(faucet.connect(sender).requestTokens(ZERO_ADDRESS, RequestType.NORMAL_REQUEST)).to.be.revertedWith("Invalid address");

        //normal request
        let userWalletOneBalance = await ethers.provider.getBalance(userWalletOne.address);
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.emit(faucet, "TokensSent").withArgs(userWalletOne.address, NORMAL_TOKENS, RequestType.NORMAL_REQUEST);
        expect(await faucet.getLastRequestTimestamp(userWalletOne.address)).is.equal(await getLastBlockTimestamp());
        expect(await ethers.provider.getBalance(userWalletOne.address)).is.equal(userWalletOneBalance.add(NORMAL_TOKENS));
        let todaySpent = BigNumber.from(0);
        todaySpent = todaySpent.add(NORMAL_TOKENS);

       
        //request with twitter
        userWalletOneBalance = await ethers.provider.getBalance(userWalletOne.address);
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.TWITTER_REQUEST)).to.emit(faucet, "TokensSent").withArgs(userWalletOne.address, TWITTER_TOKENS, RequestType.TWITTER_REQUEST);
        expect(await faucet.getLastRequestTwitterTimestamp(userWalletOne.address)).is.equal(await getLastBlockTimestamp());
        expect(await ethers.provider.getBalance(userWalletOne.address)).is.equal(userWalletOneBalance.add(TWITTER_TOKENS));
        todaySpent = todaySpent.add(TWITTER_TOKENS);
        expect(await faucet.todaySpent()).is.equal(todaySpent);
     
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.be.revertedWith(ContractErrors.ALREADY_REQUESTED.toString());
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.TWITTER_REQUEST)).to.be.revertedWith(ContractErrors.HAS_TWEETED.toString());

        await advanceTimeSeconds(COOLDOWN_PERIOD);
        userWalletOneBalance = await ethers.provider.getBalance(userWalletOne.address);

        //normal request
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.emit(faucet, "TokensSent").withArgs(userWalletOne.address, NORMAL_TOKENS, RequestType.NORMAL_REQUEST);
        expect(await ethers.provider.getBalance(userWalletOne.address)).is.equal(userWalletOneBalance.add(NORMAL_TOKENS));
        todaySpent = todaySpent.add(NORMAL_TOKENS);

        //request with twitter
        userWalletOneBalance = await ethers.provider.getBalance(userWalletOne.address);
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.TWITTER_REQUEST)).to.emit(faucet, "TokensSent").withArgs(userWalletOne.address, TWITTER_TOKENS, RequestType.TWITTER_REQUEST);
        expect(await ethers.provider.getBalance(userWalletOne.address)).is.equal(userWalletOneBalance.add(TWITTER_TOKENS));
        todaySpent = todaySpent.add(TWITTER_TOKENS);

        expect(await faucet.todaySpent()).is.equal(todaySpent);

        //faucet reached daily limit
        await expect(faucet.connect(sender).requestTokens(other.address, RequestType.NORMAL_REQUEST)).to.be.revertedWith(ContractErrors.DAILY_LIMIT_REACHED.toString());
        await expect(faucet.connect(sender).requestTokens(other.address, TWITTER_REQUEST)).to.be.revertedWith(ContractErrors.DAILY_LIMIT_REACHED.toString());

        //day changed
        await advanceTimeSeconds(SECONDS_PER_DAY);
        //now can request funds again
        await expect(faucet.connect(sender).requestTokens(other.address, RequestType.NORMAL_REQUEST)).to.emit(faucet, "TokensSent").withArgs(other.address, NORMAL_TOKENS, RequestType.NORMAL_REQUEST);
        await expect(faucet.connect(sender).requestTokens(other.address, RequestType.TWITTER_REQUEST)).to.emit(faucet, "TokensSent").withArgs(other.address, TWITTER_TOKENS, RequestType.TWITTER_REQUEST);

        //test out of funds
        await expect(faucet.connect(owner).transferAllFunds(owner.address)).to.not.be.reverted;
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.be.revertedWith(ContractErrors.OUT_OF_FUNDS.toString());
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.TWITTER_REQUEST)).to.be.revertedWith(ContractErrors.OUT_OF_FUNDS.toString());

    });

    it("Test - get faucet balance", async function () {
        expect(await faucet.getFaucetBalance()).is.equal(await ethers.provider.getBalance(faucet.address))
    });

    it("Test - transfer all funds", async function () {
        await expect(faucet.connect(other).transferAllFunds(owner.address)).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);
        await expect(faucet.connect(owner).transferAllFunds(owner.address)).to.not.be.reverted;
        expect(await faucet.getFaucetBalance()).is.equal(await ethers.provider.getBalance(faucet.address))
    });

    it("Test - pause", async function () {
        await expect(faucet.connect(other).pause()).to.be.revertedWith(`AccessControl: account ${other.address.toLowerCase()} is missing role ${ownerRole}`);
        await expect(faucet.connect(owner).pause()).to.be.revertedWith("Pausable: paused");
        await expect(faucet.connect(owner).unpause()).to.not.be.reverted;
        await expect(faucet.connect(owner).pause()).to.not.be.reverted;

    });

    it("Test - daily limit bigger than faucet balance", async function(){
       await expect(faucet.grantRole(senderRole, sender.address)).to.not.be.reverted;
       await expect(faucet.connect(owner).unpause()).to.not.be.reverted;
       await expect(faucet.connect(owner).setDailyLimit((await ethers.provider.getBalance(faucet.address)).add(DAILY_LIMIT))).to.not.be.reverted;
 
       //day changed
       await advanceTimeSeconds(SECONDS_PER_DAY);
       await expect(faucet.connect(sender).requestTokens(other.address, RequestType.NORMAL_REQUEST)).to.emit(faucet, "TokensSent").withArgs(other.address, NORMAL_TOKENS, RequestType.NORMAL_REQUEST);
       expect((await faucet.dailyLimit()).sub(NORMAL_TOKENS)).is.equal(await ethers.provider.getBalance(faucet.address));
    })

    it("Test - get faucet metadata and reset today spent", async function () {
        await expect(faucet.grantRole(senderRole, sender.address)).to.not.be.reverted;
        await expect(faucet.connect(owner).unpause()).to.not.be.reverted;

        let NEW_DAILY_LIMIT = TOKEN_UNITS.mul(4);
        await expect(faucet.connect(owner).setDailyLimit(NEW_DAILY_LIMIT)).to.not.be.reverted;
        let todaySpent = BigNumber.from(0);
        //normal request
        let userWalletOneBalance = await ethers.provider.getBalance(userWalletOne.address);
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.NORMAL_REQUEST)).to.emit(faucet, "TokensSent").withArgs(userWalletOne.address, NORMAL_TOKENS, RequestType.NORMAL_REQUEST);
        expect(await ethers.provider.getBalance(userWalletOne.address)).is.equal(userWalletOneBalance.add(NORMAL_TOKENS));
        todaySpent = todaySpent.add(NORMAL_TOKENS);

        //request with twitter
        userWalletOneBalance = await ethers.provider.getBalance(userWalletOne.address);
        await expect(faucet.connect(sender).requestTokens(userWalletOne.address, RequestType.TWITTER_REQUEST)).to.emit(faucet, "TokensSent").withArgs(userWalletOne.address, TWITTER_TOKENS, RequestType.TWITTER_REQUEST);
        expect(await ethers.provider.getBalance(userWalletOne.address)).is.equal(userWalletOneBalance.add(TWITTER_TOKENS));
        todaySpent = todaySpent.add(TWITTER_TOKENS);

        expect(await faucet.todaySpent()).is.equal(todaySpent);
     
        //faucet reached daily limit
        await expect(faucet.connect(sender).requestTokens(other.address, RequestType.NORMAL_REQUEST)).to.be.revertedWith(ContractErrors.DAILY_LIMIT_REACHED.toString());
        await expect(faucet.connect(sender).requestTokens(other.address, TWITTER_REQUEST)).to.be.revertedWith(ContractErrors.DAILY_LIMIT_REACHED.toString());
        //day changed
        await advanceTimeSeconds(SECONDS_PER_DAY);
        expect ((await faucet.getFaucetMetadata())[1]).is.equal(BigNumber.from(0))
  
    })
});