//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract XXXToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(uint256 _initialSupply) ERC20("XXX Coin", "XXX") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        grantRole(MINTER_ROLE, msg.sender);
        _mint(msg.sender, _initialSupply);
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
}
