//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./XXXToken.sol";
import "./IDaoWeights.sol";
import "./IVoting.sol";

contract Staking is IDaoWeights {
    IVoting public voting;

    bytes32 public merkleRoot;

    address private owner;

    uint256 public unstakeDelay = 1 days;

    uint8 public immutable rewardPercent = 3;

    uint32 public immutable rewardDelay = 7 days; 

    ERC20 private immutable lpToken;

    XXXToken private immutable rewardToken;

    mapping(address => uint256) public balances;

    mapping(address => bool) private whitelistChecked;

    mapping(address => uint256) private startTimes;

    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "This operation is available only to the owner"
        );
        _;
    }

    constructor(address _lpAddress, address _rewardAddress, bytes32 _root) {
        owner = msg.sender;
        lpToken = ERC20(_lpAddress);
        rewardToken = XXXToken(_rewardAddress);
        merkleRoot = _root;
    }

    function setVoting(address _voting) public {
        voting = IVoting(_voting);
    }

    function changeOwner(address _newOwner) public onlyOwner {
        owner = _newOwner;
    }

    function setMerkleRoot(bytes32 _root) public onlyOwner {
        merkleRoot = _root;
    }

    function balanceOf(address _addr) external view override returns (uint256) {
        return balances[_addr];
    }

    function stake(uint256 _amount, bytes32[] calldata _merkleProof) public {
        if (!whitelistChecked[msg.sender]) {
            bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
            require(MerkleProof.verify(_merkleProof, merkleRoot, leaf), "Incorrect merkle proof");
            whitelistChecked[msg.sender] = true;
        }

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
        require(!voting.inProgress(msg.sender), "voting is in progress");
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
        startTimes[msg.sender] += cnt * rewardDelay;
    }

    function setUnstakeDelay(uint256 _unstakeDelay) public {
        unstakeDelay = _unstakeDelay;
    }
}
