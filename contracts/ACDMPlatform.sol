//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./ACDMToken.sol";

contract ACDMPlatform {

    enum RoundType {
        SALE,
        TRADE
    }

    struct Round {
        RoundType type_;
        uint256 startTime;
    }

    uint256 private constant INITIAL_ACDM_AMOUNT = 100000e6;

    Round private currentRound;

    ACDMToken private acdmToken;

    uint256 private acdmPrice;

    mapping(address => uint256) private orders;

    uint256 private tradeAmount;

    constructor(address _acdmAddress) {
        acdmToken = ACDMToken(_acdmAddress);
    }

    function prepare() public {
        currentRound = Round({
            type_: RoundType.SALE,
            startTime: block.timestamp
        });
        acdmPrice = 1e7;
        acdmToken.mint(address(this), INITIAL_ACDM_AMOUNT);
    }

    function buy() public payable {
        require(
            currentRound.type_ == RoundType.SALE,
            "Only possible when it's SALE round"
        );
        acdmToken.transfer(msg.sender, msg.value / acdmPrice);
        checkRound();
    }

    function print() public view {
        console.log(
            "type: %d, time: %d",
            currentRound.type_ == RoundType.SALE ? 0 : 1,
            currentRound.startTime
        );
    }

    function addOrder(uint256 _amount) public {
        require(
            currentRound.type_ == RoundType.TRADE,
            "Only possible when it's TRADE round"
        );
        acdmToken.transferFrom(msg.sender, address(this), _amount);
        orders[msg.sender] += _amount;
        checkRound();
    }

    function removeOrder(uint256 _amount) public {
        require(
            currentRound.type_ == RoundType.TRADE,
            "Only possible when it's TRADE round"
        );
        acdmToken.transfer(msg.sender, _amount);
        orders[msg.sender] -= _amount;
        checkRound();
    }

    function redeemOrder(address payable _seller) public payable {
        require(
            currentRound.type_ == RoundType.TRADE,
            "Only possible when it's TRADE round"
        );

        _seller.transfer(msg.value);
        uint256 amount = msg.value / acdmPrice;
        // console.log("amount: %d, orders[_seller]: %d", amount, orders[_seller]);
        require(orders[_seller] >= amount, "Not enough amount in orders");
        acdmToken.transfer(msg.sender, amount);
        orders[_seller] -= amount;
        tradeAmount += msg.value;
        checkRound();
    }

    function checkRound() public {
        if (
            block.timestamp - currentRound.startTime > 3 days ||
            (currentRound.type_ == RoundType.SALE &&
                acdmToken.balanceOf(address(this)) == 0)
        ) {
            //print();
            finishRound();
        }
    }

    function finishRound() private {
        //console.log("finish round");
        if (currentRound.type_ == RoundType.SALE) {
            acdmToken.burn(acdmToken.balanceOf(address(this)));
            currentRound.type_ = RoundType.TRADE;
        } else if (currentRound.type_ == RoundType.TRADE) {
            currentRound.type_ = RoundType.SALE;
            acdmPrice = (acdmPrice * 103)/100 + 4e6;
            //console.log("tradeAmount: %d", tradeAmount);
            uint256 mintAmount = tradeAmount / acdmPrice;
            acdmToken.mint(address(this), mintAmount);
            tradeAmount = 0; 
        }
        currentRound.startTime = block.timestamp;
        //print();
    }
}
