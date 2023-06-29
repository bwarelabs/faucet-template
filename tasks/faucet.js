const { task } = require("hardhat/config");
const api = require("../scripts/faucet")

task("deployFaucet")
    .addParam("normalTokens")
    .addParam("twitterTokens")
    .addParam("cooldownPeriod")
    .addParam("dailyLimit")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.deployFaucet(args.normalTokens, args.twitterTokens, args.cooldownPeriod, args.dailyLimit));
    });

task("upgradeFaucet")
    .addParam("contract")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.upgradeFaucet(args.contract));
    });

task("requestTokens")
    .addParam("contract")
    .addParam("userAccount")
    .addParam("requestType")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.requestTokens(args.contract, args.userAccount, args.requestType));
    });

task("setNormalRequestTokens")
    .addParam("contract")
    .addParam("normalRequestTokensAmount")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.setNormalRequestTokens(args.contract, args.normalRequestTokensAmount));
    });

task("setTwitterRequestTokens")
    .addParam("contract")
    .addParam("twitterRequestTokensAmount")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.setTwitterRequestTokens(args.contract, args.twitterRequestTokensAmount));
    });

task("setCooldownPeriod")
    .addParam("contract")
    .addParam("cooldownPeriod")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.setCooldownPeriod(args.contract, args.cooldownPeriod));
    });

task("setDailyLimit")
    .addParam("contract")
    .addParam("dailyLimit")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.setDailyLimit(args.contract, args.dailyLimit));
    });

task("transferAllFunds")
    .addParam("contract")
    .addParam("ownerAddress")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.transferAllFunds(args.contract, args.ownerAddress));
    });

task("grantRole")
    .addParam("contract")
    .addParam("role")
    .addParam("account")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.grantRole(args.contract, args.role, args.account));
    })

task("pause")
    .addParam("contract")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.pause(args.contract));
    })

task("unpause")
    .addParam("contract")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.unpause(args.contract));
    })

task("setTodayDate")
    .addParam("contract")
    .setAction(async (args) => {
        console.log("Finalized with status:", await api.setTodayDate(args.contract));
    });
