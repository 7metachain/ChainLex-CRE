// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ChainlinkRisk.sol";

/// @title ComplianceVault - Third-party vault that gates deposits on DON-attested compliance data
/// @notice Demonstrates why DON deployment is necessary: this vault is operated by a DIFFERENT
///         party than the token issuer. It reads compliance data from ChainlinkRisk (a Compliance
///         Feed) and only accepts deposits from users whose risk assessment was independently
///         verified by the Chainlink DON — not self-reported by the token issuer.
/// @dev This is the same trust model as DeFi protocols reading Chainlink Price Feeds:
///      the data consumer trusts the DON, not the data provider.
contract ComplianceVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    ChainlinkRisk public immutable complianceFeed;

    uint256 public maxStaleness;
    bool public paused;

    mapping(address => uint256) public deposits;
    uint256 public totalDeposits;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event UserPaused(address indexed user, string reason);
    event VaultPaused(bool status);

    error NotCompliant(address user, string reason);
    error StaleComplianceData(address user, uint256 lastUpdated, uint256 maxAge);
    error VaultIsPaused();
    error InsufficientDeposit(address user, uint256 requested, uint256 available);

    /// @param _token The RWA token (e.g. ccTMMF / uRWA)
    /// @param _complianceFeed The ChainlinkRisk contract acting as Compliance Feed
    /// @param _maxStaleness Maximum age (seconds) of compliance data before considered stale
    constructor(
        address _token,
        address _complianceFeed,
        uint256 _maxStaleness
    ) Ownable(msg.sender) {
        token = IERC20(_token);
        complianceFeed = ChainlinkRisk(_complianceFeed);
        maxStaleness = _maxStaleness > 0 ? _maxStaleness : 3600; // default 1 hour
    }

    /// @notice Deposit RWA tokens into the vault
    /// @dev Requires the depositor to have a valid, non-stale, DON-attested compliance check
    function deposit(uint256 amount) external {
        if (paused) revert VaultIsPaused();

        _requireCompliant(msg.sender);

        token.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;
        totalDeposits += amount;

        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw tokens from the vault
    /// @dev Also checks compliance — a user who became non-compliant cannot withdraw freely
    function withdraw(uint256 amount) external {
        if (paused) revert VaultIsPaused();
        if (deposits[msg.sender] < amount) {
            revert InsufficientDeposit(msg.sender, amount, deposits[msg.sender]);
        }

        _requireCompliant(msg.sender);

        deposits[msg.sender] -= amount;
        totalDeposits -= amount;
        token.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Check if a user would pass the vault's compliance gate
    function checkCompliance(address user) external view returns (bool allowed, string memory reason, uint256 score, uint256 lastUpdated) {
        (allowed, reason) = complianceFeed.isUserAllowed(user);
        ChainlinkRisk.RiskAssessment memory assessment = _getAssessment(user);
        score = assessment.score;
        lastUpdated = assessment.lastUpdated;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit VaultPaused(_paused);
    }

    function setMaxStaleness(uint256 _seconds) external onlyOwner {
        maxStaleness = _seconds;
    }

    function _requireCompliant(address user) internal view {
        (bool allowed, string memory reason) = complianceFeed.isUserAllowed(user);
        if (!allowed) {
            revert NotCompliant(user, reason);
        }

        ChainlinkRisk.RiskAssessment memory assessment = _getAssessment(user);
        if (assessment.lastUpdated > 0 && block.timestamp - assessment.lastUpdated > maxStaleness) {
            revert StaleComplianceData(user, assessment.lastUpdated, maxStaleness);
        }
    }

    function _getAssessment(address user) internal view returns (ChainlinkRisk.RiskAssessment memory) {
        (
            ChainlinkRisk.RiskLevel level,
            uint256 score,
            uint256 lastUpdated,
            string memory reason,
            bool isBlacklisted
        ) = complianceFeed.riskAssessments(user);

        return ChainlinkRisk.RiskAssessment({
            level: level,
            score: score,
            lastUpdated: lastUpdated,
            reason: reason,
            isBlacklisted: isBlacklisted
        });
    }
}
