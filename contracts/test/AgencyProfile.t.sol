// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgencyProfile} from "../src/AgencyProfile.sol";

contract AgencyProfileTest is Test {
    AgencyProfile public profile;

    address owner = address(this);
    address agency1 = address(0xA1);
    address agency2 = address(0xA2);
    address nonOwner = address(0xBEEF);

    function setUp() public {
        profile = new AgencyProfile();
    }

    // ── recordCompletion ────────────────────────────────────────────────

    function test_recordCompletion() public {
        uint256 volume = 10_000 ether;
        uint256 score = 85;

        profile.recordCompletion(agency1, volume, score);

        AgencyProfile.Profile memory p = profile.getProfile(agency1);
        assertEq(p.contractsCompleted, 1, "contractsCompleted should be 1");
        assertEq(p.totalVolume, volume, "totalVolume should match");
        assertEq(p.score, score, "score should match");
        assertEq(p.contractsFailed, 0, "contractsFailed should be 0");

        // Second completion
        profile.recordCompletion(agency1, 5_000 ether, 90);
        p = profile.getProfile(agency1);
        assertEq(p.contractsCompleted, 2, "contractsCompleted should be 2");
        assertEq(p.totalVolume, volume + 5_000 ether, "totalVolume should accumulate");
        assertEq(p.score, 90, "score should be updated to latest");
    }

    // ── recordFailure ───────────────────────────────────────────────────

    function test_recordFailure() public {
        profile.recordFailure(agency1, 30);

        AgencyProfile.Profile memory p = profile.getProfile(agency1);
        assertEq(p.contractsFailed, 1, "contractsFailed should be 1");
        assertEq(p.score, 30, "score should match");
        assertEq(p.contractsCompleted, 0, "contractsCompleted should be 0");

        // Second failure
        profile.recordFailure(agency1, 15);
        p = profile.getProfile(agency1);
        assertEq(p.contractsFailed, 2, "contractsFailed should be 2");
        assertEq(p.score, 15, "score should be updated");
    }

    // ── recordDisputeResult ─────────────────────────────────────────────

    function test_recordDisputeResult_won() public {
        profile.recordDisputeResult(agency1, true, 88);

        AgencyProfile.Profile memory p = profile.getProfile(agency1);
        assertEq(p.disputesWon, 1, "disputesWon should be 1");
        assertEq(p.disputesLost, 0, "disputesLost should be 0");
        assertEq(p.score, 88, "score should match");
    }

    function test_recordDisputeResult_lost() public {
        profile.recordDisputeResult(agency1, false, 42);

        AgencyProfile.Profile memory p = profile.getProfile(agency1);
        assertEq(p.disputesWon, 0, "disputesWon should be 0");
        assertEq(p.disputesLost, 1, "disputesLost should be 1");
        assertEq(p.score, 42, "score should match");
    }

    // ── setVerified ─────────────────────────────────────────────────────

    function test_setVerified() public {
        assertFalse(profile.getProfile(agency1).verified, "should start unverified");

        profile.setVerified(agency1, true);
        assertTrue(profile.getProfile(agency1).verified, "should be verified");

        profile.setVerified(agency1, false);
        assertFalse(profile.getProfile(agency1).verified, "should be unverified again");
    }

    // ── addAttestation ──────────────────────────────────────────────────

    function test_addAttestation() public {
        bytes32 hash1 = keccak256("proof1");
        bytes32 hash2 = keccak256("proof2");

        profile.addAttestation(agency1, hash1);
        bytes32[] memory atts = profile.getAttestations(agency1);
        assertEq(atts.length, 1, "should have 1 attestation");
        assertEq(atts[0], hash1, "first attestation should match");

        profile.addAttestation(agency1, hash2);
        atts = profile.getAttestations(agency1);
        assertEq(atts.length, 2, "should have 2 attestations");
        assertEq(atts[1], hash2, "second attestation should match");
    }

    // ── onlyOwner ───────────────────────────────────────────────────────

    function test_onlyOwner() public {
        vm.startPrank(nonOwner);

        vm.expectRevert();
        profile.recordCompletion(agency1, 1 ether, 50);

        vm.expectRevert();
        profile.recordFailure(agency1, 50);

        vm.expectRevert();
        profile.recordDisputeResult(agency1, true, 50);

        vm.expectRevert();
        profile.setVerified(agency1, true);

        vm.expectRevert();
        profile.addAttestation(agency1, bytes32(0));

        vm.stopPrank();
    }

    // ── getProfile — full state after multiple ops ──────────────────────

    function test_getProfile() public {
        // Simulate a realistic history for agency1
        profile.recordCompletion(agency1, 10_000 ether, 80);
        profile.recordCompletion(agency1, 5_000 ether, 85);
        profile.recordFailure(agency1, 70);
        profile.recordDisputeResult(agency1, true, 75);
        profile.recordDisputeResult(agency1, false, 65);
        profile.setVerified(agency1, true);
        profile.addAttestation(agency1, keccak256("zkp1"));
        profile.addAttestation(agency1, keccak256("zkp2"));

        AgencyProfile.Profile memory p = profile.getProfile(agency1);

        assertEq(p.contractsCompleted, 2, "2 completions");
        assertEq(p.contractsFailed, 1, "1 failure");
        assertEq(p.disputesWon, 1, "1 dispute won");
        assertEq(p.disputesLost, 1, "1 dispute lost");
        assertEq(p.totalVolume, 15_000 ether, "total volume");
        assertEq(p.score, 65, "last score set");
        assertTrue(p.verified, "verified flag");
        assertEq(p.attestations.length, 2, "2 attestations");

        // Verify getScore convenience
        assertEq(profile.getScore(agency1), 65, "getScore should match");

        // agency2 should be empty
        AgencyProfile.Profile memory p2 = profile.getProfile(agency2);
        assertEq(p2.contractsCompleted, 0);
        assertEq(p2.score, 0);
        assertFalse(p2.verified);
        assertEq(p2.attestations.length, 0);
    }

    // ── Events ──────────────────────────────────────────────────────────

    function test_emitsProfileUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit AgencyProfile.ProfileUpdated(agency1, 80);
        profile.recordCompletion(agency1, 1 ether, 80);
    }

    function test_emitsContractCompleted() public {
        vm.expectEmit(true, false, false, true);
        emit AgencyProfile.ContractCompleted(agency1, 5 ether);
        profile.recordCompletion(agency1, 5 ether, 90);
    }

    function test_emitsContractFailed() public {
        vm.expectEmit(true, false, false, false);
        emit AgencyProfile.ContractFailed(agency1);
        profile.recordFailure(agency1, 20);
    }

    function test_emitsDisputeResolved() public {
        vm.expectEmit(true, false, false, true);
        emit AgencyProfile.DisputeResolved(agency1, true);
        profile.recordDisputeResult(agency1, true, 50);
    }

    function test_emitsVerificationUpdated() public {
        vm.expectEmit(true, false, false, true);
        emit AgencyProfile.VerificationUpdated(agency1, true);
        profile.setVerified(agency1, true);
    }

    function test_emitsAttestationAdded() public {
        bytes32 h = keccak256("test");
        vm.expectEmit(true, false, false, true);
        emit AgencyProfile.AttestationAdded(agency1, h);
        profile.addAttestation(agency1, h);
    }
}
