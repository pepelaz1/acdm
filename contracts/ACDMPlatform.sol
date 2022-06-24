//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

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

    struct PlatformUser {
        bool isRegistered;
        address referer;
    }

    error InvalidRound(RoundType required, RoundType current);

    uint256 public acdmPrice = 1e7;

    uint256 public saleComission1 = 50;

    uint256 public saleComission2 = 30;

    uint256 public tradeComission1 = 25;

    uint256 public tradeComission2 = 25;

    address public specialAddress;

    bool public isBurnCommission = false;

    Round private currentRound;

    ACDMToken private acdmToken;

    uint256 private tradeAmount;

    address private immutable owner;

    mapping(address => PlatformUser) public platformUsers;

    mapping(address => uint256) private orders;

    modifier onlyRound(RoundType _type) {
        if (currentRound.type_ != _type) {
            revert InvalidRound(_type, currentRound.type_);
        }
        _;
    }

    modifier onlyUnregistered(address _addr) {
        require(!platformUsers[_addr].isRegistered, "User already registered");
        _;
    }

    constructor(address _acdmAddress, address _specialAddress) {
        owner = msg.sender;
        acdmToken = ACDMToken(_acdmAddress);
        specialAddress = _specialAddress;
        currentRound = Round({
            type_: RoundType.SALE,
            startTime: block.timestamp
        });
    }

    function register() public onlyUnregistered(msg.sender) {
        platformUsers[msg.sender] = PlatformUser({
            isRegistered: true,
            referer: address(0)
        });
    }

    function register(address _referer) public onlyUnregistered(msg.sender) {
        platformUsers[msg.sender] = PlatformUser({
            isRegistered: true,
            referer: _referer
        });
    }

    function buy() public payable onlyRound(RoundType.SALE) {
        checkRegistration(msg.sender);
        acdmToken.transfer(msg.sender, msg.value / acdmPrice);
        distributeSale(msg.sender, msg.value);
        checkRound();
    }

    function buy(uint256 _amount) public payable onlyRound(RoundType.SALE) {
        checkRegistration(msg.sender);
        uint256 eth = _amount * acdmPrice;
        require(msg.value >= eth, "Not enough ether sent");
        acdmToken.transfer(msg.sender, _amount);
        distributeSale(msg.sender, eth);
        uint256 surplus = msg.value - eth;
        payable(msg.sender).transfer(surplus);
        checkRound();
    }

    function addOrder(uint256 _amount) public onlyRound(RoundType.TRADE) {
        checkRegistration(msg.sender);
        acdmToken.transferFrom(msg.sender, address(this), _amount);
        orders[msg.sender] += _amount;
        checkRound();
    }

    function removeOrder(uint256 _amount) public onlyRound(RoundType.TRADE) {
        checkRegistration(msg.sender);
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
        checkRegistration(msg.sender);
        uint256 amount = msg.value / acdmPrice;
        require(orders[_seller] >= amount, "Not enough amount in orders");
        acdmToken.transfer(msg.sender, amount);
        distributeTrade(_seller, msg.value);
        orders[_seller] -= amount;
        tradeAmount += msg.value;
        checkRound();
    }

    function redeemOrder(address payable _seller, uint256 _amount)
        public
        payable
        onlyRound(RoundType.TRADE)
    {
        checkRegistration(msg.sender);
        uint256 eth = _amount * acdmPrice;
        require(msg.value >= eth, "Not enough ether sent");
        require(orders[_seller] >= _amount, "Not enough amount in orders");
        acdmToken.transfer(msg.sender, _amount);
        distributeTrade(_seller, eth);
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

    function setBurnCommission(bool _isBurnCommission) external {
        isBurnCommission = _isBurnCommission;
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

    function distributeSale(address _addr, uint256 _amountEth) private {
        PlatformUser memory platformUser = platformUsers[_addr];
        uint256 commission = (_amountEth * (saleComission1 + saleComission2)) /
            1000;

        if (platformUser.referer != address(0)) {
            uint256 com1 = (_amountEth * saleComission1) / 1000;
            payable(platformUser.referer).transfer(com1);
            commission -= com1;
            platformUser = platformUsers[platformUser.referer];
            if (platformUser.referer != address(0)) {
                payable(platformUser.referer).transfer(commission);
                commission = 0;
            }
        }
        if (commission > 0) payable(specialAddress).transfer(commission);
    }

    function distributeTrade(address _addr, uint256 _amountEth) private {
        PlatformUser memory platformUser = platformUsers[_addr];
        uint256 commission = (_amountEth *
            (tradeComission1 + tradeComission2)) / 1000;

        if (platformUser.referer != address(0)) {
            uint256 com1 = (_amountEth * tradeComission1) / 1000;
            payable(platformUser.referer).transfer(com1);
            commission -= com1;
            platformUser = platformUsers[platformUser.referer];
            if (platformUser.referer != address(0)) {
                payable(platformUser.referer).transfer(commission);
                commission = 0;
            }
        }
        if (commission > 0) payable(specialAddress).transfer(commission);
        payable(_addr).transfer(_amountEth - commission);
    }

    function checkRegistration(address _addr) private {
        if (!platformUsers[_addr].isRegistered) {
            register();
        }
    }
}
