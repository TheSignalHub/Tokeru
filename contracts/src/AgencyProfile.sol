// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract AgencyProfile is Ownable {
    struct Profile {
        uint256 contractsCompleted;
        uint256 contractsFailed;
        uint256 disputesWon;
        uint256 disputesLost;
        uint256 totalVolume;
        uint256 score;          // 0-100
        bool verified;          // KYC/KYB verified
        bytes32[] attestations; // ZKP proof hashes
    }

    mapping(address => Profile) public profiles;

    event ProfileUpdated(address indexed agency, uint256 score);
    event ContractCompleted(address indexed agency, uint256 volume);
    event ContractFailed(address indexed agency);
    event DisputeResolved(address indexed agency, bool won);
    event VerificationUpdated(address indexed agency, bool verified);
    event AttestationAdded(address indexed agency, bytes32 proofHash);

    constructor() Ownable(msg.sender) {}

    function recordCompletion(address agency, uint256 volume, uint256 newScore) external onlyOwner {
        Profile storage p = profiles[agency];
        p.contractsCompleted++;
        p.totalVolume += volume;
        p.score = newScore;
        emit ContractCompleted(agency, volume);
        emit ProfileUpdated(agency, newScore);
    }

    function recordFailure(address agency, uint256 newScore) external onlyOwner {
        Profile storage p = profiles[agency];
        p.contractsFailed++;
        p.score = newScore;
        emit ContractFailed(agency);
        emit ProfileUpdated(agency, newScore);
    }

    function recordDisputeResult(address agency, bool won, uint256 newScore) external onlyOwner {
        Profile storage p = profiles[agency];
        if (won) p.disputesWon++;
        else p.disputesLost++;
        p.score = newScore;
        emit DisputeResolved(agency, won);
        emit ProfileUpdated(agency, newScore);
    }

    function setVerified(address agency, bool status) external onlyOwner {
        profiles[agency].verified = status;
        emit VerificationUpdated(agency, status);
    }

    function addAttestation(address agency, bytes32 proofHash) external onlyOwner {
        profiles[agency].attestations.push(proofHash);
        emit AttestationAdded(agency, proofHash);
    }

    function getProfile(address agency) external view returns (Profile memory) {
        return profiles[agency];
    }

    function getScore(address agency) external view returns (uint256) {
        return profiles[agency].score;
    }

    function getAttestations(address agency) external view returns (bytes32[] memory) {
        return profiles[agency].attestations;
    }
}
