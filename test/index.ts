import { expect } from "chai";
import { MerkleTree } from 'merkletreejs';
import { loadFixture } from "ethereum-waffle";
import { BigNumber, utils } from "ethers";
//import { BigNumber } from "ethers";
import { ethers, network } from "hardhat";
//const hardhat = require("hardhat");
const keccak256 = require("keccak256")
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

  let acc6: any;

  let xxxtoken: any;

  let acdmtoken: any;

  let lpToken: any;

  let router: any;

  let factory: any;

  let leafs: any;

  let tree: any;

  let staking: any;

  let dao: any;

  let platform: any;

  let distributor: any;

  step('deploy tokens', async function () {
    [acc1, acc2, acc3, acc4, acc5, acc6] = await ethers.getSigners()

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


  
  step('deploy staking with markle tree', async function () {

    let addresses = [
      acc1.address,
      acc2.address,
      acc3.address,
      acc4.address,
      acc5.address,
    ]
    leafs = addresses.map(addr => keccak256(addr))
    tree = new MerkleTree(leafs, keccak256, {sortPairs: true})
    //console.log(tree.toString())

    const root = tree.getRoot()
    //console.log(root)

    const Staking = await ethers.getContractFactory('Staking')
    staking = await Staking.deploy(lpToken.address, xxxtoken.address, root)
    await staking.deployed()

    await lpToken.connect(acc1).approve(staking.address, MaxUint256);
    await lpToken.connect(acc2).approve(staking.address, MaxUint256);
    await lpToken.connect(acc3).approve(staking.address, MaxUint256);
    await lpToken.connect(acc4).approve(staking.address, MaxUint256);

    await xxxtoken.grantRole(await xxxtoken.MINTER_ROLE(), staking.address)
  });

  step('deploy dao', async function () {
    const Dao = await ethers.getContractFactory('Dao', acc1)
    dao = await Dao.deploy(staking.address, parseUnits('7', 15), 60 * 60 * 24 * 3)
    await dao.deployed()

    await dao.grantRole(await dao.CHAIRMAN_ROLE(), acc1.address)

    await staking.setVoting(dao.address);
  });

  step('deploy platform', async function () {

    const Distributor = await ethers.getContractFactory('ACDMDistributor', acc1)
    distributor = await Distributor.deploy(router.address, xxxtoken.address)
    await distributor.deployed()

    await xxxtoken.grantRole(await xxxtoken.BURNER_ROLE(), distributor.address)
    
    const Platform = await ethers.getContractFactory('ACDMPlatform', acc1)
    platform = await Platform.deploy(acdmtoken.address, distributor.address)
    await platform.deployed()

    await acdmtoken.grantRole(await acdmtoken.MINTER_ROLE(), platform.address)
    let tx = await acdmtoken.mint(platform.address, parseUnits('100000', 6));
    await tx.wait()

    tx = await staking.changeOwner(platform.address);
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
  });

  step('staking', async function () {
    let amount = await lpToken.balanceOf(acc1.address)
    let tx = await staking.stake(amount, tree.getHexProof(leafs[0]))
    await tx.wait()

    amount = await lpToken.balanceOf(acc2.address)
    tx = await staking.connect(acc2).stake(amount, tree.getHexProof(leafs[1]))
    await tx.wait()

    amount = await lpToken.balanceOf(acc3.address)
    tx = await staking.connect(acc3).stake(amount,  tree.getHexProof(leafs[2]))
    await tx.wait()

    amount = await lpToken.balanceOf(acc4.address)
    tx = await staking.connect(acc4).stake(amount, tree.getHexProof(leafs[3]))
    await tx.wait()

    await expect(staking.connect(acc6).stake(amount, tree.getHexProof(leafs[4]))).to.be.revertedWith("Incorrect merkle proof")
  });

  step('register', async function () {
    let tx = await distributor.connect(acc1)["register()"]()
    await tx.wait()

    expect((await distributor.platformUsers(acc1.address)).isRegistered).to.equal(true)

    await expect(distributor.connect(acc1)["register()"]()).to.be.revertedWith("User already registered")

    tx = await distributor.connect(acc2)["register(address)"](acc1.address)
    await tx.wait()

    expect((await distributor.platformUsers(acc2.address)).referer).to.equal(acc1.address)

    tx = await distributor.connect(acc3)["register(address)"](acc2.address)
    await tx.wait()

    expect((await distributor.platformUsers(acc3.address)).referer).to.equal(acc2.address)

    tx = await distributor.connect(acc4)["register(address)"](acc1.address)
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


    let tx = await platform["buy()"]({ value: parseEther('0.5') })
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
    await expect(platform.connect(acc4)["buy(uint256)"](parseUnits("10000", 6), { value: parseEther('1.0') })).to.be.revertedWith("InvalidRound(0, 1)")

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

    await expect(platform.removeOrder(parseUnits("100000", 6))).to.be.revertedWith("Not enough amount")

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

    tx = await platform.connect(acc6)["buy(uint256)"](parseUnits("100", 6), { value: parseEther('1.0') })
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


    tx = await platform.connect(acc1)["redeemOrder(address)"](acc2.address, { value: parseEther('0.05') });
    await tx.wait()

    await expect(platform.connect(acc1)["redeemOrder(address)"](acc2.address, { value: parseEther('5.0') })).to.be.revertedWith("Not enough amount in orders")

    await expect(platform.connect(acc1)["redeemOrder(address,uint256)"](acc2.address, parseUnits("100000", 6), { value: parseEther('1.0') })).to.be.revertedWith("Not enough ether sent")

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

    tx = await dao.connect(acc1).vote(0, true)
    await tx.wait()

    let day = 1 * 24 * 60 * 60

    await network.provider.send("evm_increaseTime", [day])

    await expect(staking.connect(acc1).unstake()).to.be.revertedWith("voting is in progress")

    tx = await dao.connect(acc2).vote(0, true)
    await tx.wait()

    tx = await dao.connect(acc3).vote(0, false)
    await tx.wait()

    tx = await dao.connect(acc4).vote(0, true)
    await tx.wait()

    await network.provider.send("evm_increaseTime", [daoDuration])

    tx = await dao.finishProposal(0)
    await tx.wait()

    expect(await staking.unstakeDelay()).to.equal(newDelay)

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

  step('voting to choose what to do with comission', async function () {
    var abi = [{
      "inputs": [
        {
          "internalType": "bool",
          "name": "_isBurnCommission",
          "type": "bool"
        }
      ],
      "name": "setBurnCommission",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
    ];

    const calldata = new ethers.utils.Interface(abi).encodeFunctionData('setBurnCommission', [true]);

    let tx = await dao.addProposal(distributor.address, calldata, 'burn commission or send to owner?')
    await tx.wait()

    tx = await dao.connect(acc1).vote(1, true)
    await tx.wait()

    tx = await dao.connect(acc2).vote(1, true)
    await tx.wait()

    tx = await dao.connect(acc3).vote(1, true)
    await tx.wait()

    tx = await dao.connect(acc4).vote(1, true)
    await tx.wait()

    await network.provider.send("evm_increaseTime", [daoDuration])

    tx = await dao.finishProposal(1)
    await tx.wait()

    expect(await distributor.isBurnCommission()).to.equal(true)

    tx = await distributor.manageComission()
    await tx.wait()

    expect(await xxxtoken.balanceOf(distributor.address)).to.equal(0)

  });

});
