const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BlockchainVoting", function () {
  let BlockchainVoting;
  let votingContract;
  let owner;
  let voter1;
  let voter2;

  beforeEach(async function () {
    [owner, voter1, voter2] = await ethers.getSigners();
    
    BlockchainVoting = await ethers.getContractFactory("BlockchainVoting");
    votingContract = await BlockchainVoting.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right admin", async function () {
      expect(await votingContract.admin()).to.equal(owner.address);
    });

    it("Should initialize with genesis block hash", async function () {
      const lastBlockHash = await votingContract.lastBlockHash();
      expect(lastBlockHash).to.not.equal(ethers.ZeroHash);
    });
  });

  describe("Election Management", function () {
    it("Should create a new election", async function () {
      const startDate = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const endDate = startDate + 86400; // 24 hours later
      
      await expect(votingContract.createElection(
        "Student Council Election",
        "Annual student council election",
        startDate,
        endDate
      )).to.emit(votingContract, "ElectionCreated");

      const election = await votingContract.elections(1);
      expect(election.title).to.equal("Student Council Election");
      expect(election.isActive).to.be.true;
    });

    it("Should not allow non-admin to create election", async function () {
      const startDate = Math.floor(Date.now() / 1000) + 3600;
      const endDate = startDate + 86400;
      
      await expect(votingContract.connect(voter1).createElection(
        "Test Election",
        "Test",
        startDate,
        endDate
      )).to.be.revertedWith("Only admin can perform this action");
    });
  });

  describe("Candidate Registration", function () {
    beforeEach(async function () {
      const startDate = Math.floor(Date.now() / 1000) + 3600;
      const endDate = startDate + 86400;
      
      await votingContract.createElection(
        "Test Election",
        "Test",
        startDate,
        endDate
      );
    });

    it("Should register a candidate", async function () {
      await expect(votingContract.registerCandidate(
        1,
        "John Doe",
        "President",
        "Computer Science",
        "Senior",
        "https://example.com/photo.jpg",
        "I will improve student life"
      )).to.emit(votingContract, "CandidateRegistered");

      const candidate = await votingContract.candidates(1);
      expect(candidate.name).to.equal("John Doe");
      expect(candidate.position).to.equal("President");
    });
  });

  describe("Voting", function () {
    let electionId;
    let candidateId;
    let startDate;
    let endDate;

    beforeEach(async function () {
      startDate = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      endDate = startDate + 86400 * 7; // 7 days total
      
      await votingContract.createElection(
        "Test Election",
        "Test",
        startDate,
        endDate
      );
      electionId = 1;

      await votingContract.registerCandidate(
        electionId,
        "John Doe",
        "President",
        "Computer Science",
        "Senior",
        "https://example.com/photo.jpg",
        "I will improve student life"
      );
      candidateId = 1;
    });

    it("Should allow voting", async function () {
      await expect(votingContract.connect(voter1).castVote(
        electionId,
        candidateId,
        "President"
      )).to.emit(votingContract, "VoteCast");

      const hasVoted = await votingContract.hasVoted(electionId, voter1.address);
      expect(hasVoted).to.be.true;

      const candidate = await votingContract.candidates(candidateId);
      expect(candidate.voteCount).to.equal(1);
    });

    it("Should prevent double voting", async function () {
      await votingContract.connect(voter1).castVote(
        electionId,
        candidateId,
        "President"
      );

      await expect(votingContract.connect(voter1).castVote(
        electionId,
        candidateId,
        "President"
      )).to.be.revertedWith("Voter has already voted in this election");
    });

    it("Should verify votes with verification code", async function () {
      await votingContract.connect(voter1).castVote(
        electionId,
        candidateId,
        "President"
      );

      const voteBlock = await votingContract.voteBlocks(1);
      const isValid = await votingContract.verifyVote(1, voteBlock.verificationCode);
      expect(isValid).to.be.true;
    });
  });

  describe("Results and Queries", function () {
    let electionId;
    let candidateId1;
    let candidateId2;

    beforeEach(async function () {
      const startDate = Math.floor(Date.now() / 1000) - 3600;
      const endDate = startDate + 86400 * 7;
      
      await votingContract.createElection(
        "Test Election",
        "Test",
        startDate,
        endDate
      );
      electionId = 1;

      await votingContract.registerCandidate(
        electionId,
        "John Doe",
        "President",
        "CS",
        "Senior",
        "photo1.jpg",
        "Manifesto 1"
      );
      candidateId1 = 1;

      await votingContract.registerCandidate(
        electionId,
        "Jane Smith",
        "President",
        "EE",
        "Junior",
        "photo2.jpg",
        "Manifesto 2"
      );
      candidateId2 = 2;
    });

    it("Should return election results", async function () {
      // Cast votes
      await votingContract.connect(voter1).castVote(electionId, candidateId1, "President");
      await votingContract.connect(voter2).castVote(electionId, candidateId1, "President");

      const [candidateIds, voteCounts] = await votingContract.getElectionResults(electionId);
      
      expect(candidateIds.length).to.equal(2);
      expect(voteCounts[0]).to.equal(2); // candidateId1 got 2 votes
      expect(voteCounts[1]).to.equal(0); // candidateId2 got 0 votes
    });

    it("Should return vote history for voter", async function () {
      await votingContract.connect(voter1).castVote(electionId, candidateId1, "President");
      
      const voteHistory = await votingContract.getVoteHistory(voter1.address);
      expect(voteHistory.length).to.equal(1);
      expect(voteHistory[0].voter).to.equal(voter1.address);
    });
  });
});