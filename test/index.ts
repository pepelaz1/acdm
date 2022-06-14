import { expect } from "chai";
import { ethers } from "hardhat";
const { parseEther } = ethers.utils;

describe("ACDMPlatform", function () {
  let acc1: any;

  let acc2: any;

  let acc3: any;

  let acc4: any;

  let xxxtoken: any;

  let acdmtoken: any;

  step('init', async function() {
    [acc1, acc2, acc3, acc4] = await ethers.getSigners()

    // deploy XXX token
    const Erc20Token = await ethers.getContractFactory('XXXToken', acc1)
    xxxtoken = await Erc20Token.deploy(parseEther("10000"))
    await xxxtoken.deployed()  

     // deploy ACDM token
     const ACDMToken = await ethers.getContractFactory('ACDMToken', acc1)
     acdmtoken = await ACDMToken.deploy(parseEther("10000"))
     await acdmtoken.deployed()  
  });
});
