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

    uint256 public acdmPrice = 1e7;

    mapping(address => uint256) private orders;

    uint256 private tradeAmount;

    modifier onlyRound(RoundType _type) {
        require(
            currentRound.type_ == _type,
            string(
                abi.encodePacked(
                    "Only possible when it's ",
                    _type == RoundType.SALE ? "SALE" : "ROUND",
                    " round"
                )
            )
        );
        _;
    }

    constructor(address _acdmAddress) {
        acdmToken = ACDMToken(_acdmAddress);
        currentRound = Round({
            type_: RoundType.SALE,
            startTime: block.timestamp
        });
    }

    function buy() public payable onlyRound(RoundType.SALE) {
        acdmToken.transfer(msg.sender, msg.value / acdmPrice);
        checkRound();
    }

    function buy(uint256 _amount) public payable onlyRound(RoundType.SALE) {
        uint256 eth = _amount * acdmPrice;
        //console.log("eth %d", eth);
        require(msg.value >= eth, "Not enough ether sent");
        acdmToken.transfer(msg.sender, _amount);
        uint256 surplus = msg.value - eth;
        payable(msg.sender).transfer(surplus);
        checkRound();
    }

    function print() public view {
        console.log(
            "type: %d, time: %d",
            currentRound.type_ == RoundType.SALE ? 0 : 1,
            currentRound.startTime
        );
    }

    function addOrder(uint256 _amount) public onlyRound(RoundType.TRADE) {
        acdmToken.transferFrom(msg.sender, address(this), _amount);
        orders[msg.sender] += _amount;
        checkRound();
    }

    function removeOrder(uint256 _amount) public onlyRound(RoundType.TRADE) {
        acdmToken.transfer(msg.sender, _amount);
        orders[msg.sender] -= _amount;
        checkRound();
    }

    function redeemOrder(address payable _seller)
        public
        payable
        onlyRound(RoundType.TRADE)
    {
        _seller.transfer(msg.value);
        uint256 amount = msg.value / acdmPrice;
        // console.log("amount: %d, orders[_seller]: %d", amount, orders[_seller]);
        require(orders[_seller] >= amount, "Not enough amount in orders");
        acdmToken.transfer(msg.sender, amount);
        orders[_seller] -= amount;
        tradeAmount += msg.value;
        checkRound();
    }

    function redeemOrder(address payable _seller, uint256 _amount)
        public
        payable
        onlyRound(RoundType.TRADE)
    {    
        uint256 eth = _amount * acdmPrice;
        require(msg.value >= eth, "Not enough ether sent");
        require(orders[_seller] >= _amount, "Not enough amount in orders");
        _seller.transfer(eth);
         acdmToken.transfer(msg.sender, _amount);
        orders[_seller] -= _amount;
        tradeAmount += eth;
        uint256 surplus = msg.value - eth;
        payable(msg.sender).transfer(surplus);
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
            acdmPrice = (acdmPrice * 103) / 100 + 4e6;
            uint256 mintAmount = tradeAmount / acdmPrice;

            // console.log("amountBefore: %d", acdmToken.balanceOf(address(this)));

            // console.log(
            //     "tradeAmount: %d, price: %d, mintAmount: %d",
            //     tradeAmount,
            //     acdmPrice,
            //     mintAmount
            // );
            acdmToken.mint(address(this), mintAmount);
            // console.log("amountAfter: %d", acdmToken.balanceOf(address(this)));
            tradeAmount = 0;
        }
        currentRound.startTime = block.timestamp;
        //print();
    }
}
