//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ACDMToken is ERC20 { 
    constructor(uint256 _initialSupply) ERC20("ACADEM Coin", "ACDM") {
        _mint(msg.sender, _initialSupply);
    }

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}