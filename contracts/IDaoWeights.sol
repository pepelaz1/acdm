//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IDaoWeights {
    function balanceOf(address _addr) external view returns(uint256);
}