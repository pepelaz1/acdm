import { expect } from "chai";
//import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
//const hardhat = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;
const { MaxUint256 } = ethers.constants;
const routerAddress = process.env.UNISWAP_ROUTER_ADDRESS as string;
const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS as string;
const xxxtokenAddress = "0xad518536Ecb7e8677Dc9e821b26FEEe1Bb8Db3d0";
const roundDuration = 60*60*24*3;

describe("ACDMPlatform", function () {
  let acc1: any;

  let acc2: any;

  let acc3: any;

  let acc4: any;

  let xxxtoken: any;

  let acdmtoken: any;

  let lpToken: any;

  let router: any;

  let factory: any;

  let staking: any;

  let dao: any;

  let platform: any;

  step('deploy tokens', async function () {
    [acc1, acc2, acc3, acc4] = await ethers.getSigners()

    //deploy XXX token
    const Erc20Token = await ethers.getContractFactory('XXXToken', acc1)
    xxxtoken = await Erc20Token.deploy(parseEther("10000"))
    await xxxtoken.deployed()

    // get XXX token
    //  xxxtoken = await ethers.getContractAt("ERC20", xxxtokenAddress);


    // deploy ACDM token
    const ACDMToken = await ethers.getContractFactory('ACDMToken', acc1)
    acdmtoken = await ACDMToken.deploy(parseUnits('20000', 6))
    await acdmtoken.deployed()
  });

  step('configure uniswap', async function () {
    factory = await ethers.getContractAt("IUniswapV2Factory", factoryAddress);
    router = await ethers.getContractAt("IUniswapV2Router02", routerAddress);
    const wethAddress = await router.WETH()

    // create pair XXX/ETH
    let tx = await factory.createPair(xxxtoken.address, wethAddress);
    await tx.wait();

    const pairAddress = await factory.getPair(xxxtoken.address, wethAddress);
    //console.log(pairAddress)
    lpToken = await ethers.getContractAt("ERC20", pairAddress);

    // approve
    await xxxtoken.approve(routerAddress, MaxUint256)
  });

  step('deploy staking', async function () {
    const Staking = await ethers.getContractFactory('Staking')
    staking = await Staking.deploy(lpToken.address, xxxtoken.address)
    await staking.deployed()

    await lpToken.connect(acc1).approve(staking.address, MaxUint256);
    await lpToken.connect(acc2).approve(staking.address, MaxUint256);
    await lpToken.connect(acc3).approve(staking.address, MaxUint256);
    await lpToken.connect(acc4).approve(staking.address, MaxUint256);
  });

  step('deploy dao', async function () {
    const Dao = await ethers.getContractFactory('Dao', acc1)
    dao = await Dao.deploy(lpToken.address, parseEther('400'), 60 * 60 * 24 * 3)
    await dao.deployed()

    await dao.grantRole(await dao.CHAIRMAN_ROLE(), acc1.address)
  });

  step('deploy platform', async function () {
    const Platform = await ethers.getContractFactory('ACDMPlatform', acc1)
    platform = await Platform.deploy(acdmtoken.address)
    await dao.deployed()

    await acdmtoken.grantRole(await acdmtoken.MINTER_ROLE(), platform.address)
    let tx = await platform.prepare();
    await tx.wait();

    await acdmtoken.connect(acc1).approve(platform.address, MaxUint256);
    await acdmtoken.connect(acc2).approve(platform.address, MaxUint256);
    await acdmtoken.connect(acc3).approve(platform.address, MaxUint256);
    await acdmtoken.connect(acc4).approve(platform.address, MaxUint256);
    // await acdmtoken.mint(platform.address, ethers.utils.parseUnits('100000', 6))

    //console.log(await acdmtoken.balanceOf(platform.address))
  });

  step('add liquidity', async function () {
    let tx = await router.addLiquidityETH(xxxtoken.address, parseEther('1'), 0, 0, acc1.address, MaxUint256, {
      value: parseEther('0.00001')
    });
    await tx.wait();

    tx = await router.addLiquidityETH(xxxtoken.address, parseEther('0.9'), 0, 0, acc2.address, MaxUint256, {
      value: parseEther('0.000009')
    });
    await tx.wait();

    tx = await router.addLiquidityETH(xxxtoken.address, parseEther('0.8'), 0, 0, acc3.address, MaxUint256, {
      value: parseEther('0.000008')
    });
    await tx.wait();

    tx = await router.addLiquidityETH(xxxtoken.address, parseEther('0.5'), 0, 0, acc4.address, MaxUint256, {
      value: parseEther('0.000005')
    });
    await tx.wait();

    // console.log(await lpToken.balanceOf(acc1.address));
    // console.log(await lpToken.balanceOf(acc2.address));
    // console.log(await lpToken.balanceOf(acc3.address));
    // console.log(await lpToken.balanceOf(acc4.address));
  });

  step('staking', async function () {
    let amount = await lpToken.balanceOf(acc1.address)
    let tx = await staking.stake(amount)
    await tx.wait()

    amount = await lpToken.balanceOf(acc2.address)
    tx = await staking.connect(acc2).stake(amount)
    await tx.wait()

    amount = await lpToken.balanceOf(acc3.address)
    tx = await staking.connect(acc3).stake(amount)
    await tx.wait()

    amount = await lpToken.balanceOf(acc4.address)
    tx = await staking.connect(acc4).stake(amount)
    await tx.wait()
  });

  step('voting', async function () {

  });

  step('sale round 1', async function () {
    //console.log(await acdmtoken.balanceOf(platform.address))

    let tx = await platform.buy({ value: parseEther('0.5') })
    await tx.wait()

    expect(await acdmtoken.balanceOf(acc1.address)).to.equal(parseUnits("70000", 6))

    tx = await platform.connect(acc2).buy({ value: parseEther('0.2') })
    await tx.wait()

    expect(await acdmtoken.balanceOf(acc2.address)).to.equal(parseUnits("20000", 6))

    tx = await platform.connect(acc3).buy({ value: parseEther('0.3') })
    await tx.wait()

    expect(await acdmtoken.balanceOf(acc3.address)).to.equal(parseUnits("30000", 6))

    // This finishes this round within
    await expect(platform.connect(acc4).buy({ value: parseEther('0.1') })).to.be.revertedWith("Only possible when it's SALE round")

    expect(await acdmtoken.balanceOf(platform.address)).to.equal(0)
  });

  step('trade round 1', async function () {
    //console.log(await acdmtoken.balanceOf(platform.address))

    let tx = await platform.checkRound()
    await tx.wait()

    tx = await platform.addOrder(parseUnits("10000", 6))
    await tx.wait()

    tx = await platform.removeOrder(parseUnits("10000", 6))
    await tx.wait()

    tx = await platform.addOrder(parseUnits("30000", 6))
    await tx.wait()

    expect(await acdmtoken.balanceOf(platform.address)).to.equal(parseUnits("30000", 6))

    tx = await platform.connect(acc2).redeemOrder(acc1.address, { value: parseEther('0.15') });
    await tx.wait()

    tx = await platform.connect(acc3).redeemOrder(acc1.address, { value: parseEther('0.05') });
    await tx.wait()

    await expect(platform.connect(acc4).redeemOrder(acc1.address, { value: parseEther('0.11') })).to.be.revertedWith("Not enough amount in orders")

    await network.provider.send("evm_increaseTime", [roundDuration]) 
  });

  step('sale round 2', async function () {
    let tx = await platform.checkRound()
    await tx.wait()


  });
});
