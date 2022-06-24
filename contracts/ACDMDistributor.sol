//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "./ACDMPlatform.sol";
import "./XXXToken.sol";
import "hardhat/console.sol";

contract ACDMDistributor {
    uint256 public saleComission1 = 50;

    uint256 public saleComission2 = 30;

    uint256 public tradeComission1 = 25;

    uint256 public tradeComission2 = 25;

    bool public isBurnCommission = false;

    IUniswapV2Router02 private router;

    address private immutable owner;

    address private immutable token;

    struct PlatformUser {
        bool isRegistered;
        address referer;
    }

    mapping(address => PlatformUser) public platformUsers;

    modifier onlyUnregistered(address _addr) {
        require(!platformUsers[_addr].isRegistered, "User already registered");
        _;
    }

    constructor(address _router, address _token) {
        owner = msg.sender;
        router = IUniswapV2Router02(_router);
        token = _token;
    }

    function distribute(ACDMPlatform.RoundType type_, address _seller)
        external
        payable
    {
        if (type_ == ACDMPlatform.RoundType.SALE) {
            _distribute(
                type_,
                _seller,
                msg.value,
                saleComission1,
                saleComission2
            );
        } else {
            _distribute(
                type_,
                _seller,
                msg.value,
                tradeComission1,
                tradeComission2
            );
        }
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

    function checkRegistration(address _addr) public {
        if (!platformUsers[_addr].isRegistered) {
            register();
        }
    }

    function setBurnCommission(bool _isBurnCommission) external {
        isBurnCommission = _isBurnCommission;
    }

    function manageComission() public {
        if (isBurnCommission) {
            address[] memory path = new address[](2);
            path[0] = router.WETH();
            path[1] = token;

            router.swapExactETHForTokensSupportingFeeOnTransferTokens{value: address(this).balance}(
                1,
                path,
                address(this),
                block.timestamp 
            );

            uint256 amount = ERC20(token).balanceOf(address(this));
            XXXToken(token).burn(amount);
        } else {
            payable(owner).transfer(address(this).balance);
        }
    }

    function _distribute(
        ACDMPlatform.RoundType type_,
        address _addr,
        uint256 _amountEth,
        uint256 commission1,
        uint256 comission2
    ) private {
        PlatformUser memory platformUser = platformUsers[_addr];
        uint256 commission = (_amountEth * (commission1 + comission2)) / 1000;

        if (platformUser.referer != address(0)) {
            uint256 comm = (_amountEth * commission1) / 1000;
            payable(platformUser.referer).transfer(comm);
            commission -= comm;
            platformUser = platformUsers[platformUser.referer];
            if (platformUser.referer != address(0)) {
                payable(platformUser.referer).transfer(commission);
                commission = 0;
            }
        }
        if (type_ == ACDMPlatform.RoundType.TRADE) {
            payable(_addr).transfer(_amountEth - commission);
        }
    }
}
