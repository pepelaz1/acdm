//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

interface IVoting {
    function inProgress(address _addr) external view returns(bool);
}