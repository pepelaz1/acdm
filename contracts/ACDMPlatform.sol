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
    Round private currentRound;

    ACDMToken private acdmToken;

    uint256 private acdmAmount = 100000e6;

    uint256 private acdmPrice = 1e7;

    constructor(address _acdmAddress) {
        acdmToken = ACDMToken(_acdmAddress);
    }

    function prepare() public {
        currentRound = Round({
            type_: RoundType.SALE,
            startTime: block.timestamp
        });
        acdmToken.mint(address(this), acdmAmount);
    }

    function buy() public payable {
        checkRound();
        require(
            currentRound.type_ == RoundType.SALE,
            "Only possible when it's SALE round"
        );
        acdmToken.transfer(msg.sender, msg.value / acdmPrice);
    }

    function addOrder(uint256 _amount) public {
        checkRound();
        require(
            currentRound.type_ == RoundType.TRADE,
            "Only possible when it's TRADE round"
        );
    }

    function removeOrder() public {
        checkRound();
        require(
            currentRound.type_ == RoundType.TRADE,
            "Only possible when it's TRADE round"
        );
    }

    function redeemOrder() public payable {
        checkRound();
        require(
            currentRound.type_ == RoundType.TRADE,
            "Only possible when it's TRADE round"
        );
    }

    function checkRound() private {
        if (block.timestamp - currentRound.startTime > 3 days || acdmToken.balanceOf(address(this)) == 0) {
            finishRound();
        }
    }

    function finishRound() private {
        console.log("finish round");
        currentRound.type_ = currentRound.type_ == RoundType.SALE
            ? RoundType.TRADE
            : RoundType.SALE;
        currentRound.startTime = block.timestamp;
    }
}
