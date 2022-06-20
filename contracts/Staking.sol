//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./XXXToken.sol";

contract Staking {
    address private immutable owner;

    ERC20 private immutable lpToken;

    XXXToken private immutable rewardToken;

    uint256 private rewardPercent = 20;

    mapping(address => uint256) public balances;

    // times when stacking begins
    mapping(address => uint256) startTimes;

    // unstake delay in minutes
    uint256 private unstakeDelay = 3 days;

    // reward delay in minutes
    uint256 private rewardDelay = 20;

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "This operation is available only to the owner"
        );
        _;
    }

    modifier timePassed(uint256 _duration) {
        require(
            block.timestamp > startTimes[msg.sender] + _duration * 60,
            "Time delay has not passed yet"
        );
        _;
    }

    constructor(address _lpAddress, address _rewardAddress) {
        owner = msg.sender;
        lpToken = ERC20(_lpAddress);
        rewardToken = XXXToken(_rewardAddress);
    }

    function stake(uint256 _amount) public {
        lpToken.transferFrom(msg.sender, address(this), _amount);
        balances[msg.sender] += _amount;

        if (
            startTimes[msg.sender] != 0 &&
            block.timestamp > startTimes[msg.sender] + rewardDelay * 60
        ) {
            claim();
        } else {
            startTimes[msg.sender] = block.timestamp;
        }
    }

    function unstake() public timePassed(unstakeDelay) {
        if (block.timestamp > startTimes[msg.sender] + rewardDelay * 60) {
            claim();
        }
        lpToken.transfer(msg.sender, balances[msg.sender]);
        balances[msg.sender] = 0;
    }

    function claim() public {
        uint256 cnt = ((block.timestamp - startTimes[msg.sender]) / 60) /
            rewardDelay;
        uint256 totalReward = (balances[msg.sender] * rewardPercent * cnt) /
            100;
        rewardToken.transfer(msg.sender, totalReward);
        startTimes[msg.sender] = block.timestamp;
    }

    function configure(
        uint256 _rewardPercent,
        uint256 _rewardDelay,
        uint256 _unstakeDelay
    ) public onlyOwner {
        rewardPercent = _rewardPercent;
        rewardDelay = _rewardDelay;
        unstakeDelay = _unstakeDelay;
    }

    function getRewardDelay() public view returns (uint256) {
        return rewardDelay;
    }

    function getRewardPercent() public view returns (uint256) {
        return rewardPercent;
    }

    function getUnstakeDelay() public view returns (uint256) {
        return unstakeDelay;
    }

    function setUnstakeDelay(uint256 _unstakeDelay) public {
        unstakeDelay = _unstakeDelay;
    }
}
