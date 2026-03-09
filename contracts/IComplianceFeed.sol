// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

/// @title IComplianceFeed - Standard interface for on-chain compliance data
/// @notice Any protocol can integrate this interface to check user compliance status
/// @dev Backed by DON-attested risk assessments via Chainlink CRE
interface IComplianceFeed {
    /// @notice Check if a user is allowed to participate (risk level within acceptable range)
    /// @param user The address to check
    /// @return allowed True if the user passes compliance checks
    /// @return reason Human-readable reason if not allowed
    function isUserAllowed(address user) external view returns (bool allowed, string memory reason);

    /// @notice Check if a transfer between two addresses is allowed
    /// @param from Sender address
    /// @param to Receiver address
    /// @return allowed True if the transfer passes compliance checks
    /// @return reason Human-readable reason if not allowed
    function isTransferAllowed(address from, address to) external view returns (bool allowed, string memory reason);

    /// @notice Get the raw risk score for an address (0-1000, higher = riskier)
    /// @param user The address to query
    /// @return score Risk score
    /// @return lastUpdated Timestamp of last DON attestation
    function getRiskScore(address user) external view returns (uint256 score, uint256 lastUpdated);
}
