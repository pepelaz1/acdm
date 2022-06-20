//SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "./XXXToken.sol";
import "./Staking.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Dao is AccessControl {
    bytes32 public constant CHAIRMAN_ROLE = keccak256("CHAIRMAN_ROLE");

    Staking private staking;

    ERC20 private immutable lpToken;

    uint256 private immutable minQuorum;

    uint256 private immutable duration;

    mapping(address => uint256) private lastProposals;

    mapping(address => mapping(uint256 => bool)) private voted;

    struct Proposal {
        address targetContract;
        bool isOver;
        bytes data;
        uint256 amount;
        uint256 start;
        string desc;
    }

    Proposal[] private proposals;

    event ProposalAdded(uint256 indexed id);

    event ProposalDataExecuted(uint256 indexed id);

    constructor(
        address _staking,
        address _token,
        uint256 _minQuorum,
        uint256 _duration
    ) {
        staking = Staking(_staking);
        lpToken = ERC20(_token);
        minQuorum = _minQuorum;
        duration = _duration;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function addProposal(
        address _targetContract,
        bytes memory _data,
        string memory _desc
    ) public onlyRole(CHAIRMAN_ROLE) {
        proposals.push(
            Proposal({
                targetContract: _targetContract,
                data: _data,
                amount: 0,
                start: block.timestamp,
                desc: _desc,
                isOver: false
            })
        );
        emit ProposalAdded(proposals.length - 1);
    }

    function vote(uint256 _id) public {
        require(voted[msg.sender][_id] == false, "already voted");
        proposals[_id].amount += staking.balances(msg.sender);
        voted[msg.sender][_id] = true;
        if (_id > lastProposals[msg.sender]) {
            lastProposals[msg.sender] = _id;
        }
    }

    function finishProposal(uint256 _id) public {
        require(
            block.timestamp >= proposals[_id].start + duration,
            "proposal is not over yet"
        );
        require(proposals[_id].isOver == false, "can't finish proposal twice");
        proposals[_id].isOver = true;
        if (proposals[_id].amount > minQuorum) {
            callSignature(proposals[_id].targetContract, proposals[_id].data);
            emit ProposalDataExecuted(_id);
        }
    }

    function callSignature(address _targetContract, bytes memory _signature)
        private
    {
        (bool success, bytes memory returnData) = _targetContract.call(
            _signature
        );
        if (success == false) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }
    }
}
