import { expect } from "chai";
import { loadFixture } from "ethereum-waffle";
import { BigNumber, utils } from "ethers";
//import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
//const hardhat = require("hardhat");
const { parseEther, parseUnits } = ethers.utils;
const { MaxUint256 } = ethers.constants;
const routerAddress = process.env.UNISWAP_ROUTER_ADDRESS as string;
const factoryAddress = process.env.UNISWAP_FACTORY_ADDRESS as string;
const xxxtokenAddress = "0xad518536Ecb7e8677Dc9e821b26FEEe1Bb8Db3d0";
const roundDuration = 60 * 60 * 24 * 3;
const daoDuration = 60 * 60 * 24 * 3;

describe("ACDMPlatform", function () {
  let acc1: any;

  let acc2: any;

  let acc3: any;

  let acc4: any;

  let acc5: any;

  let xxxtoken: any;

  let acdmtoken: any;

  let lpToken: any;

  let router: any;

  let factory: any;

  let staking: any;

  let dao: any;

  let platform: any;

  step('deploy tokens', async function () {
    [acc1, acc2, acc3, acc4, acc5] = await ethers.getSigners()

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

    await xxxtoken.grantRole(await xxxtoken.MINTER_ROLE(), staking.address)
  });

  step('deploy dao', async function () {
    const Dao = await ethers.getContractFactory('Dao', acc1)
    dao = await Dao.deploy(staking.address, lpToken.address, parseUnits('7', 15), 60 * 60 * 24 * 3)
    await dao.deployed()

    await dao.grantRole(await dao.CHAIRMAN_ROLE(), acc1.address)
  });

  step('deploy platform', async function () {
    const Platform = await ethers.getContractFactory('ACDMPlatform', acc1)
    platform = await Platform.deploy(acdmtoken.address, acc5.address)
    await dao.deployed()

    await acdmtoken.grantRole(await acdmtoken.MINTER_ROLE(), platform.address)
    let tx = await acdmtoken.mint(platform.address, parseUnits('100000', 6));
    await tx.wait()

    await acdmtoken.connect(acc1).approve(platform.address, MaxUint256);
    await acdmtoken.connect(acc2).approve(platform.address, MaxUint256);
    await acdmtoken.connect(acc3).approve(platform.address, MaxUint256);
    await acdmtoken.connect(acc4).approve(platform.address, MaxUint256);
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

  step('register', async function () {
    let tx = await platform.connect(acc1)["register()"]()
    await tx.wait()

    expect((await platform.platformUsers(acc1.address)).isRegistered).to.equal(true)

    tx = await platform.connect(acc2)["register(address)"](acc1.address)
    await tx.wait()

    expect((await platform.platformUsers(acc2.address)).referer1).to.equal(acc1.address)

    tx = await platform.connect(acc3)["register(address)"](acc2.address)
    await tx.wait()

    expect((await platform.platformUsers(acc3.address)).referer1).to.equal(acc2.address)
    expect((await platform.platformUsers(acc3.address)).referer2).to.equal(acc1.address)

    tx = await platform.connect(acc4)["register(address)"](acc1.address)
    await tx.wait()
  });

  step('sale round 1', async function () {
    // console.log("Sale round 1 acdm price:", (await acdmtoken.balanceOf(platform.address)).toString())
    //console.log("Sale round 1 acdm price:", (await platform.acdmPrice()).toString())

    let eth1;

    let eth2;

    let comm;

    let acdmPrice = await platform.acdmPrice()

    await expect(platform["buy(uint256)"](parseUnits("50000", 6), { value: parseEther('0.4') })).to.be.revertedWith("Not enough ether sent")

    let tx = await platform["buy(uint256)"](parseUnits("50000", 6), { value: parseEther('1.0') })
    await tx.wait()

    expect(await acdmtoken.balanceOf(acc1.address)).to.equal(parseUnits("70000", 6))

    eth1 = await ethers.provider.getBalance(acc1.address)

    tx = await platform.connect(acc2)["buy(uint256)"](parseUnits("20000", 6), { value: parseEther('1.0') })
    await tx.wait()

    comm = acdmPrice.mul(parseUnits("20000", 6)).mul(5).div(100);
    expect(await ethers.provider.getBalance(acc1.address)).to.equal(eth1.add(comm))

    expect(await acdmtoken.balanceOf(acc2.address)).to.equal(parseUnits("20000", 6))

    eth1 = await ethers.provider.getBalance(acc1.address)
    eth2 = await ethers.provider.getBalance(acc2.address)

    tx = await platform.connect(acc3)["buy(uint256)"](parseUnits("30000", 6), { value: parseEther('1.0') })
    await tx.wait()

    comm = acdmPrice.mul(parseUnits("30000", 6)).mul(5).div(100);
    expect(await ethers.provider.getBalance(acc2.address)).to.equal(eth2.add(comm))

    comm = acdmPrice.mul(parseUnits("30000", 6)).mul(3).div(100);
    expect(await ethers.provider.getBalance(acc1.address)).to.equal(eth1.add(comm))

    expect(await acdmtoken.balanceOf(acc3.address)).to.equal(parseUnits("30000", 6))

    // This finishes this round within
    await expect(platform.connect(acc4)["buy(uint256)"](parseUnits("10000", 6), { value: parseEther('1.0') })).to.be.revertedWith("Only possible when it's SALE round")

    expect(await acdmtoken.balanceOf(platform.address)).to.equal(0)
  });

  step('trade round 1', async function () {
    //console.log(await acdmtoken.balanceOf(platform.address))

    let eth1;

    let eth2;

    let comm;

    let tx = await platform.checkRound()
    await tx.wait()

    let acdmPrice = await platform.acdmPrice()


    tx = await platform.addOrder(parseUnits("10000", 6))
    await tx.wait()

    tx = await platform.removeOrder(parseUnits("10000", 6))
    await tx.wait()

    tx = await platform.addOrder(parseUnits("30000", 6))
    await tx.wait()

    expect(await acdmtoken.balanceOf(platform.address)).to.equal(parseUnits("30000", 6))

    tx = await platform.connect(acc3).addOrder(parseUnits("30000", 6))
    await tx.wait()

    tx = await platform.connect(acc2)["redeemOrder(address,uint256)"](acc1.address, parseUnits("10000", 6), { value: parseEther('1.0') });
    await tx.wait()


    tx = await platform.connect(acc3)["redeemOrder(address,uint256)"](acc1.address, parseUnits("15000", 6), { value: parseEther('1.0') });
    await tx.wait()

    await expect(platform.connect(acc4)["redeemOrder(address,uint256)"](acc1.address, parseUnits("11000", 6), { value: parseEther('1.0') })).to.be.revertedWith("Not enough amount in orders")

    eth1 = await ethers.provider.getBalance(acc1.address)
    eth2 = await ethers.provider.getBalance(acc2.address)
 
    tx = await platform.connect(acc2)["redeemOrder(address,uint256)"](acc3.address, parseUnits("10000", 6), { value: parseEther('0.1') });
    const receipt = await tx.wait()

    let purchase = acdmPrice.mul(parseUnits("10000", 6))

    comm = acdmPrice.mul(parseUnits("10000", 6)).mul(25).div(1000);
    expect(await ethers.provider.getBalance(acc1.address)).to.equal(eth1.add(comm))
    expect(await ethers.provider.getBalance(acc2.address)).to.equal(eth2.sub(receipt.gasUsed).sub(purchase).add(comm))

    await network.provider.send("evm_increaseTime", [roundDuration])
  });

  step('sale round 2', async function () {
    let tx = await platform.checkRound()
    await tx.wait()

    //console.log("Sale round 2 acdm price:", (await platform.acdmPrice()).toString())
    //console.log("Sale round 2 acdm amount:", (await acdmtoken.balanceOf(platform.address)).toString())

    tx = await platform.connect(acc4)["buy(uint256)"](parseUnits("5000", 6), { value: parseEther('1.0') })
    await tx.wait()

    tx = await platform.connect(acc2)["buy(uint256)"](parseUnits("6000", 6), { value: parseEther('1.0') })
    await tx.wait()

    tx = await platform.connect(acc3)["buy(uint256)"](parseUnits("3000", 6), { value: parseEther('1.0') })
    await tx.wait()

    await network.provider.send("evm_increaseTime", [roundDuration])
  });

  step('trade round 2', async function () {
    let tx = await platform.checkRound()
    await tx.wait()

    tx = await platform.connect(acc2).addOrder(parseUnits("20000", 6))
    await tx.wait()

    tx = await platform.connect(acc4).addOrder(parseUnits("5000", 6))
    await tx.wait()

    tx = await platform.connect(acc1)["redeemOrder(address,uint256)"](acc2.address, parseUnits("5000", 6), { value: parseEther('1.0') });
    await tx.wait()

    tx = await platform.connect(acc3)["redeemOrder(address,uint256)"](acc4.address, parseUnits("2000", 6), { value: parseEther('1.0') });
    await tx.wait()

    await network.provider.send("evm_increaseTime", [roundDuration])
  });

  step('sale round 3', async function () {
    let tx = await platform.checkRound()
    await tx.wait()

    //console.log("Sale round 3 acdm price:", (await platform.acdmPrice()).toString())
    //console.log("Sale round 3 acdm amount:", (await acdmtoken.balanceOf(platform.address)).toString())

  });

  step('voting to increase staking period', async function () {
    var abi = [{
      "inputs": [
        {
          "internalType": "uint256",
          "name": "_unstakeDelay",
          "type": "uint256"
        }
      ],
      "name": "setUnstakeDelay",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
    ];

    let newDelay = 4 * 24 * 60 * 60

    const calldata = new ethers.utils.Interface(abi).encodeFunctionData('setUnstakeDelay', [newDelay]);

    let tx = await dao.addProposal(staking.address, calldata, 'increase staking period')
    await tx.wait()

    tx = await dao.connect(acc1).vote(0)
    await tx.wait()

    tx = await dao.connect(acc2).vote(0)
    await tx.wait()

    tx = await dao.connect(acc4).vote(0)
    await tx.wait()

    await network.provider.send("evm_increaseTime", [daoDuration])

    tx = await dao.finishProposal(0)
    await tx.wait()

    expect(await staking.getUnstakeDelay()).to.equal(newDelay)

  });


  step('withdraw staking rewards', async function () {
    let tx = await staking.connect(acc1).claim();
    await tx.wait()

    tx = await staking.connect(acc2).claim();
    await tx.wait()

    tx = await staking.connect(acc3).claim();
    await tx.wait()

    tx = await staking.connect(acc4).claim();
    await tx.wait()
  });

});
