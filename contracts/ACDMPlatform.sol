//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "./ACDMToken.sol";
import "./ACDMDistributor.sol";

contract ACDMPlatform {
    enum RoundType {
        SALE,
        TRADE
    }

    struct Round {
        RoundType type_;
        uint256 startTime;
    }

    error InvalidRound(RoundType required, RoundType current);

    uint256 public acdmPrice = 1e7;

    ACDMDistributor public distributor;

    Round private currentRound;

    ACDMToken private acdmToken;

    uint256 private tradeAmount;

    mapping(address => uint256) private orders;

    modifier onlyRound(RoundType _type) {
        if (currentRound.type_ != _type) {
            revert InvalidRound(_type, currentRound.type_);
        }
        _;
    }

    constructor(address _acdmAddress, address _distributor) {
        acdmToken = ACDMToken(_acdmAddress);
        distributor = ACDMDistributor(_distributor);
        currentRound = Round({
            type_: RoundType.SALE,
            startTime: block.timestamp
        });
    }

    function buy() public payable onlyRound(RoundType.SALE) {
        distributor.checkRegistration(msg.sender);
        acdmToken.transfer(msg.sender, msg.value / acdmPrice);
        distributor.distribute{value: msg.value}(
            currentRound.type_,
            msg.sender
        );
        checkRound();
    }

    function buy(uint256 _amount) public payable onlyRound(RoundType.SALE) {
        distributor.checkRegistration(msg.sender);
        uint256 eth = _amount * acdmPrice;
        require(msg.value >= eth, "Not enough ether sent");
        acdmToken.transfer(msg.sender, _amount);
        distributor.distribute{value: eth}(currentRound.type_, msg.sender);
        uint256 surplus = msg.value - eth;
        payable(msg.sender).transfer(surplus);
        checkRound();
    }

    function addOrder(uint256 _amount) public onlyRound(RoundType.TRADE) {
        distributor.checkRegistration(msg.sender);
        acdmToken.transferFrom(msg.sender, address(this), _amount);
        orders[msg.sender] += _amount;
        checkRound();
    }

    function removeOrder(uint256 _amount) public onlyRound(RoundType.TRADE) {
        distributor.checkRegistration(msg.sender);
        require(_amount <= orders[msg.sender], "Not enough amount");
        acdmToken.transfer(msg.sender, _amount);
        orders[msg.sender] -= _amount;
        checkRound();
    }

    function redeemOrder(address payable _seller)
        public
        payable
        onlyRound(RoundType.TRADE)
    {
        distributor.checkRegistration(msg.sender);
        uint256 amount = msg.value / acdmPrice;
        require(orders[_seller] >= amount, "Not enough amount in orders");
        acdmToken.transfer(msg.sender, amount);
        distributor.distribute{value: msg.value}(currentRound.type_, _seller);
        orders[_seller] -= amount;
        tradeAmount += msg.value;
        checkRound();
    }

    function redeemOrder(address payable _seller, uint256 _amount)
        public
        payable
        onlyRound(RoundType.TRADE)
    {
        distributor.checkRegistration(msg.sender);
        uint256 eth = _amount * acdmPrice;
        require(msg.value >= eth, "Not enough ether sent");
        require(orders[_seller] >= _amount, "Not enough amount in orders");
        acdmToken.transfer(msg.sender, _amount);
        distributor.distribute{value: eth}(currentRound.type_, _seller);
        orders[_seller] -= _amount;
        tradeAmount += eth;
        uint256 surplus = msg.value - eth;
        if (surplus > 0) payable(msg.sender).transfer(surplus);
        checkRound();
    }

    function checkRound() public {
        if (
            block.timestamp - currentRound.startTime > 3 days ||
            (currentRound.type_ == RoundType.SALE &&
                acdmToken.balanceOf(address(this)) == 0)
        ) {
            finishRound();
        }
    }

    function finishRound() private {
        if (currentRound.type_ == RoundType.SALE) {
            acdmToken.burn(acdmToken.balanceOf(address(this)));
            currentRound.type_ = RoundType.TRADE;
        } else {
            currentRound.type_ = RoundType.SALE;
            acdmPrice = (acdmPrice * 103) / 100 + 4e6;
            uint256 mintAmount = tradeAmount / acdmPrice;
            acdmToken.mint(address(this), mintAmount);
            tradeAmount = 0;
        }
        currentRound.startTime = block.timestamp;
    }
}
