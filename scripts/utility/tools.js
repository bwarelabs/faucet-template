const { BigNumber } = require("ethers");
const { keccak256 } = require("@ethersproject/keccak256");
const { toUtf8Bytes } = require("@ethersproject/strings");

module.exports = {
    configKey: function (keyStr) {
        return ethers.utils.formatBytes32String(keyStr);
    },

    attachToContract: async function (name, address) {
        return await ethers.getContractAt(name, address);
    },

    getTxStatus: async function (arguments, tx) {
        console.log(`call: ${arguments.callee.name} 
        - args: ${JSON.stringify([...arguments])} 
        - hash: ${tx.hash}\n`);
        return (await tx.wait()).status === 1 ? true : false;
    },

    toBytesRole: function (roleStr) {
        return keccak256(toUtf8Bytes(roleStr));
    },

    ONE_TOKEN_UNITS: BigNumber.from(10).pow(18)
}
