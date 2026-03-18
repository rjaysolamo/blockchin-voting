const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SimpleStudentVoting", function () {
  let Voting;
  let voting;
  let admin;
  let alice;
  let bob;
  let carol;

  const POSITIONS = {
    PRESIDENT: 0,
    VICE_PRESIDENT: 1,
    SECRETARY: 2,
    TREASURER: 3,
    AUDITOR: 4,
    PRO_COMMUNICATIONS: 5,
    BUSINESS_MANAGER_FINANCE_OFFICER: 6,
    ACADEMIC_AFFAIRS_OFFICER: 7,
    STUDENT_WELFARE_OFFICER: 8,
    YEAR_LEVEL_DEPARTMENT_REPRESENTATIVE: 9,
  };

  async function createElectionWindow(offsetToStart = 3600, duration = 86400) {
    const now = await time.latest();
    const start = now + offsetToStart;
    const end = start + duration;

    await voting.createElection("Student Council 2026", start, end);
    return { electionId: 1, start, end };
  }

  beforeEach(async function () {
    [admin, alice, bob, carol] = await ethers.getSigners();
    Voting = await ethers.getContractFactory("contracts/BlockchainVoting.sol:SimpleStudentVoting");
    voting = await Voting.deploy();
    await voting.waitForDeployment();
  });

  describe("Deployment", function () {
    it("sets the deployer as admin", async function () {
      expect(await voting.admin()).to.equal(admin.address);
    });

    it("starts election and candidate ids from 1", async function () {
      expect(await voting.getElectionCount()).to.equal(0);
    });
  });

  describe("Admin Access", function () {
    it("prevents non-admin from creating elections", async function () {
      const now = await time.latest();
      await expect(
        voting.connect(alice).createElection("Nope", now + 100, now + 200)
      ).to.be.revertedWith("Only admin");
    });

    it("prevents non-admin from registering students", async function () {
      await expect(
        voting.connect(alice).registerStudent("STU-001", "Alice", alice.address)
      ).to.be.revertedWith("Only admin");
    });
  });

  describe("Student and Whitelist", function () {
    it("registers students and tracks eligibility per election", async function () {
      const { electionId } = await createElectionWindow();

      await voting.registerStudent("STU-001", "Alice", alice.address);
      await voting.whitelistVoter(electionId, alice.address);

      expect(await voting.isEligibleVoter(electionId, alice.address)).to.equal(true);

      await voting.setStudentStatus(alice.address, false);
      expect(await voting.isEligibleVoter(electionId, alice.address)).to.equal(false);
    });

    it("updates wallet mapping for student id", async function () {
      await voting.registerStudent("STU-001", "Alice", alice.address);
      await voting.updateStudentWallet(alice.address, bob.address);

      const student = await voting.students(bob.address);
      expect(student.studentId).to.equal("STU-001");
      expect(student.isRegistered).to.equal(true);

      const key = ethers.keccak256(ethers.toUtf8Bytes("STU-001"));
      expect(await voting.studentIdToWallet(key)).to.equal(bob.address);
    });
  });

  describe("Candidates and Positions", function () {
    it("supports all configured positions", async function () {
      expect(await voting.positionName(POSITIONS.PRESIDENT)).to.equal("President");
      expect(await voting.positionName(POSITIONS.VICE_PRESIDENT)).to.equal("Vice President");
      expect(await voting.positionName(POSITIONS.SECRETARY)).to.equal("Secretary");
      expect(await voting.positionName(POSITIONS.TREASURER)).to.equal("Treasurer");
      expect(await voting.positionName(POSITIONS.AUDITOR)).to.equal("Auditor");
      expect(await voting.positionName(POSITIONS.PRO_COMMUNICATIONS)).to.equal("PRO / Communications");
      expect(await voting.positionName(POSITIONS.BUSINESS_MANAGER_FINANCE_OFFICER)).to.equal(
        "Business Manager / Finance Officer"
      );
      expect(await voting.positionName(POSITIONS.ACADEMIC_AFFAIRS_OFFICER)).to.equal(
        "Academic Affairs Officer"
      );
      expect(await voting.positionName(POSITIONS.STUDENT_WELFARE_OFFICER)).to.equal(
        "Student Welfare Officer"
      );
      expect(await voting.positionName(POSITIONS.YEAR_LEVEL_DEPARTMENT_REPRESENTATIVE)).to.equal(
        "Year-level / Department Representatives"
      );
    });

    it("rejects invalid position", async function () {
      await expect(voting.positionName(10)).to.be.revertedWith("Invalid position");
    });

    it("registers candidates only before election starts", async function () {
      const { electionId, start } = await createElectionWindow(200, 1000);

      await expect(voting.registerCandidate(electionId, "Alice A", POSITIONS.PRESIDENT))
        .to.emit(voting, "CandidateRegistered")
        .withArgs(1, electionId, "Alice A", POSITIONS.PRESIDENT);

      await time.increaseTo(start + 1);
      await expect(voting.registerCandidate(electionId, "Late Entry", POSITIONS.PRESIDENT)).to.be.revertedWith(
        "Election already started"
      );
    });
  });

  describe("Voting and Results", function () {
    it("allows one vote per position and prevents double voting for the same position", async function () {
      const { electionId, start } = await createElectionWindow(200, 2000);

      await voting.registerCandidate(electionId, "Alice Pres", POSITIONS.PRESIDENT); // id 1
      await voting.registerCandidate(electionId, "Bob Pres", POSITIONS.PRESIDENT); // id 2
      await voting.registerCandidate(electionId, "Carol Sec", POSITIONS.SECRETARY); // id 3

      await voting.registerStudent("STU-001", "Voter A", alice.address);
      await voting.whitelistVoter(electionId, alice.address);

      await time.increaseTo(start + 1);

      await expect(voting.connect(alice).castVote(electionId, 1))
        .to.emit(voting, "VoteCast")
        .withArgs(electionId, 1, alice.address, POSITIONS.PRESIDENT);

      expect(await voting.hasStudentVotedForPosition(electionId, POSITIONS.PRESIDENT, alice.address)).to.equal(true);

      await expect(voting.connect(alice).castVote(electionId, 2)).to.be.revertedWith(
        "Already voted for this position"
      );

      await expect(voting.connect(alice).castVote(electionId, 3))
        .to.emit(voting, "VoteCast")
        .withArgs(electionId, 3, alice.address, POSITIONS.SECRETARY);
    });

    it("returns per-position candidate list and vote counts", async function () {
      const { electionId, start } = await createElectionWindow(120, 2000);

      await voting.registerCandidate(electionId, "Alice Pres", POSITIONS.PRESIDENT); // 1
      await voting.registerCandidate(electionId, "Bob Pres", POSITIONS.PRESIDENT); // 2

      await voting.registerStudent("STU-001", "Voter A", alice.address);
      await voting.registerStudent("STU-002", "Voter B", bob.address);
      await voting.whitelistVoter(electionId, alice.address);
      await voting.whitelistVoter(electionId, bob.address);

      await time.increaseTo(start + 1);

      await voting.connect(alice).castVote(electionId, 1);
      await voting.connect(bob).castVote(electionId, 1);

      const [ids, names, votes] = await voting.getResultsByPosition(electionId, POSITIONS.PRESIDENT);

      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(1);
      expect(ids[1]).to.equal(2);
      expect(names[0]).to.equal("Alice Pres");
      expect(names[1]).to.equal("Bob Pres");
      expect(votes[0]).to.equal(2);
      expect(votes[1]).to.equal(0);
    });

    it("prevents non-whitelisted students from voting", async function () {
      const { electionId, start } = await createElectionWindow(100, 1000);

      await voting.registerCandidate(electionId, "Alice Pres", POSITIONS.PRESIDENT);
      await voting.registerStudent("STU-001", "Voter A", alice.address);

      await time.increaseTo(start + 1);

      await expect(voting.connect(alice).castVote(electionId, 1)).to.be.revertedWith("Not whitelisted");
    });
  });
});
