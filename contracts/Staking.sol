//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./XXXToken.sol";
import "./IDaoWeights.sol";

contract Staking is IDaoWeights {
    uint256 public rewardPercent = 3;

    uint256 public unstakeDelay = 3 days;

    uint256 public rewardDelay = 7 days;

    address private immutable owner;

    ERC20 private immutable lpToken;

    XXXToken private immutable rewardToken;

    mapping(address => uint256) public balances;

    mapping(address => uint256) private startTimes;

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "This operation is available only to the owner"
        );
        _;
    }

    constructor(address _lpAddress, address _rewardAddress) {
        owner = msg.sender;
        lpToken = ERC20(_lpAddress);
        rewardToken = XXXToken(_rewardAddress);
    }

    function balanceOf(address _addr) public view returns(uint256) {
        return balances[_addr];
    }

    function stake(uint256 _amount) public {
        lpToken.transferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;

        if (
            startTimes[msg.sender] != 0 &&
            block.timestamp > startTimes[msg.sender] + rewardDelay
        ) {
            claim();
        } else {
            startTimes[msg.sender] = block.timestamp;
        }
    }

    function unstake() public {
        require(
            block.timestamp > startTimes[msg.sender] + unstakeDelay,
            "Time delay has not passed yet"
        );
        if (block.timestamp > startTimes[msg.sender] + rewardDelay) {
            claim();
        }
        lpToken.transfer(msg.sender, balances[msg.sender]);
        balances[msg.sender] = 0;
    }

    function claim() public {
        uint256 cnt = (block.timestamp - startTimes[msg.sender]) / rewardDelay;
        uint256 totalReward = (balances[msg.sender] * rewardPercent * cnt) /
            100;
        rewardToken.mint(msg.sender, totalReward);
    }

    function setUnstakeDelay(uint256 _unstakeDelay) public {
        unstakeDelay = _unstakeDelay;
    }
}
