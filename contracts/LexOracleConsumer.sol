// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "./ChainlinkRisk.sol";

interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title LexOracleConsumer - Receives CRE workflow reports and forwards risk data to ChainlinkRisk
contract LexOracleConsumer is IReceiver, Ownable {
    ChainlinkRisk public riskContract;
    address public forwarderAddress;

    event RiskReportReceived(
        address indexed user,
        uint8 level,
        uint256 score,
        string reason,
        bool isBlacklisted
    );

    error InvalidSender(address sender, address expected);

    constructor(
        address _forwarderAddress,
        address _riskContractAddress
    ) Ownable(msg.sender) {
        forwarderAddress = _forwarderAddress;
        riskContract = ChainlinkRisk(_riskContractAddress);
    }

    function setForwarderAddress(address _forwarder) external onlyOwner {
        forwarderAddress = _forwarder;
    }

    function onReport(bytes calldata, bytes calldata report) external override {
        if (forwarderAddress != address(0) && msg.sender != forwarderAddress) {
            revert InvalidSender(msg.sender, forwarderAddress);
        }

        (
            address user,
            uint8 level,
            uint256 score,
            string memory reason,
            bool isBlacklisted
        ) = abi.decode(report, (address, uint8, uint256, string, bool));

        emit RiskReportReceived(user, level, score, reason, isBlacklisted);

        riskContract.updateRiskAssessment(
            user,
            ChainlinkRisk.RiskLevel(level),
            score,
            reason,
            isBlacklisted
        );
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
