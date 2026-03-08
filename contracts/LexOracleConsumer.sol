// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "./ChainlinkRisk.sol";

interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title LexOracleConsumer - DON-exclusive receiver for CRE risk assessment reports
/// @notice Only accepts reports from the Chainlink KeystoneForwarder (DON-signed).
///         Enforces temporal integrity by rejecting stale reports.
///         Supports workflow identity verification for defense-in-depth.
contract LexOracleConsumer is IReceiver, Ownable {
    ChainlinkRisk public riskContract;

    // --- DON identity enforcement ---
    address public forwarderAddress;
    bytes32 public expectedWorkflowId;
    address public expectedWorkflowOwner;

    // --- Temporal integrity ---
    uint256 public maxReportAge;
    mapping(address => uint256) public lastReportTimestamp;

    // --- Statistics ---
    uint256 public totalReportsProcessed;
    uint256 public totalReportsRejected;

    event RiskReportReceived(
        address indexed user,
        uint8 level,
        uint256 score,
        string reason,
        bool isBlacklisted
    );
    event ReportRejected(address indexed sender, string reason);
    event ForwarderUpdated(address indexed previous, address indexed current);
    event WorkflowIdUpdated(bytes32 indexed previous, bytes32 indexed current);
    event WorkflowOwnerUpdated(address indexed previous, address indexed current);
    event MaxReportAgeUpdated(uint256 previous, uint256 current);

    error InvalidSender(address sender, address expected);
    error StaleReport(address user, uint256 lastUpdate, uint256 minInterval);
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidWorkflowOwner(address received, address expected);

    constructor(
        address _forwarderAddress,
        address _riskContractAddress,
        uint256 _maxReportAge
    ) Ownable(msg.sender) {
        forwarderAddress = _forwarderAddress;
        riskContract = ChainlinkRisk(_riskContractAddress);
        maxReportAge = _maxReportAge > 0 ? _maxReportAge : 300; // default 5 minutes
    }

    // --- Admin functions ---

    function setForwarderAddress(address _forwarder) external onlyOwner {
        emit ForwarderUpdated(forwarderAddress, _forwarder);
        forwarderAddress = _forwarder;
    }

    function setExpectedWorkflowId(bytes32 _id) external onlyOwner {
        emit WorkflowIdUpdated(expectedWorkflowId, _id);
        expectedWorkflowId = _id;
    }

    function setExpectedWorkflowOwner(address _owner) external onlyOwner {
        emit WorkflowOwnerUpdated(expectedWorkflowOwner, _owner);
        expectedWorkflowOwner = _owner;
    }

    function setMaxReportAge(uint256 _seconds) external onlyOwner {
        emit MaxReportAgeUpdated(maxReportAge, _seconds);
        maxReportAge = _seconds;
    }

    // --- Core: DON report processing ---

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        // Layer 1: Forwarder address check — ONLY KeystoneForwarder can call
        if (forwarderAddress != address(0) && msg.sender != forwarderAddress) {
            totalReportsRejected++;
            emit ReportRejected(msg.sender, "invalid_sender");
            revert InvalidSender(msg.sender, forwarderAddress);
        }

        // Layer 2: Workflow identity verification (if configured)
        if (expectedWorkflowId != bytes32(0) || expectedWorkflowOwner != address(0)) {
            (bytes32 workflowId, , address workflowOwner) = _decodeMetadata(metadata);

            if (expectedWorkflowId != bytes32(0) && workflowId != expectedWorkflowId) {
                totalReportsRejected++;
                emit ReportRejected(msg.sender, "invalid_workflow_id");
                revert InvalidWorkflowId(workflowId, expectedWorkflowId);
            }
            if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
                totalReportsRejected++;
                emit ReportRejected(msg.sender, "invalid_workflow_owner");
                revert InvalidWorkflowOwner(workflowOwner, expectedWorkflowOwner);
            }
        }

        // Decode risk assessment payload
        (
            address user,
            uint8 level,
            uint256 score,
            string memory reason,
            bool isBlacklisted
        ) = abi.decode(report, (address, uint8, uint256, string, bool));

        // Layer 3: Temporal integrity — reject if updated too recently
        if (maxReportAge > 0 && lastReportTimestamp[user] > 0) {
            uint256 elapsed = block.timestamp - lastReportTimestamp[user];
            if (elapsed < maxReportAge) {
                totalReportsRejected++;
                emit ReportRejected(msg.sender, "report_too_frequent");
                revert StaleReport(user, lastReportTimestamp[user], maxReportAge);
            }
        }

        // All checks passed — process the report
        lastReportTimestamp[user] = block.timestamp;
        totalReportsProcessed++;

        emit RiskReportReceived(user, level, score, reason, isBlacklisted);

        riskContract.updateRiskAssessment(
            user,
            ChainlinkRisk.RiskLevel(level),
            score,
            reason,
            isBlacklisted
        );
    }

    // --- Metadata decoding (abi.encodePacked by KeystoneForwarder) ---
    function _decodeMetadata(
        bytes memory metadata
    ) internal pure returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner) {
        assembly {
            workflowId := mload(add(metadata, 32))
            workflowName := mload(add(metadata, 64))
            workflowOwner := shr(mul(12, 8), mload(add(metadata, 74)))
        }
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
