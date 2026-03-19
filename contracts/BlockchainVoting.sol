// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract BlockchainVoting {
    address public immutable admin;

    // Fixed positions
    uint8 public constant PRESIDENT = 0;
    uint8 public constant VICE_PRESIDENT = 1;
    uint8 public constant SECRETARY = 2;
    uint8 public constant TREASURER = 3;
    uint8 public constant AUDITOR = 4;
    uint8 public constant PRO_COMMUNICATIONS = 5;
    uint8 public constant BUSINESS_MANAGER_FINANCE_OFFICER = 6;
    uint8 public constant ACADEMIC_AFFAIRS_OFFICER = 7;
    uint8 public constant STUDENT_WELFARE_OFFICER = 8;
    uint8 public constant YEAR_LEVEL_DEPARTMENT_REPRESENTATIVE = 9;


    uint256 private nextElectionId = 1;
    uint256 private nextCandidateId = 1;

    struct Student {
        string studentId;
        string name;
        bool isRegistered;
        bool isActive;
    }

    struct Election {
        uint256 id;
        string title;
        uint256 startDate;
        uint256 endDate;
        bool isActive;
    }

    struct Candidate {
        uint256 id;
        uint256 electionId;
        string name;
        uint8 position; // See fixed position constants above
        uint256 voteCount;
    }

    mapping(address => Student) public students;
    mapping(bytes32 => address) public studentIdToWallet;

    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate) public candidates;

    // electionId => wallet => whitelisted?
    mapping(uint256 => mapping(address => bool)) public isWhitelistedVoter;

    // electionId => position => wallet => already voted?
    mapping(uint256 => mapping(uint8 => mapping(address => bool))) public hasVotedPerPosition;

    // electionId => position => candidate ids
    mapping(uint256 => mapping(uint8 => uint256[])) private candidateIdsByPosition;

    event StudentRegistered(string studentId, string name, address wallet);
    event StudentWalletUpdated(address indexed oldWallet, address indexed newWallet, string studentId);
    event StudentStatusUpdated(address indexed wallet, bool isActive);

    event ElectionCreated(uint256 indexed electionId, string title, uint256 startDate, uint256 endDate);
    event ElectionStatusUpdated(uint256 indexed electionId, bool isActive);

    event CandidateRegistered(uint256 indexed candidateId, uint256 indexed electionId, string name, uint8 position);

    event VoterWhitelisted(uint256 indexed electionId, address indexed wallet);
    event VoterRemovedFromWhitelist(uint256 indexed electionId, address indexed wallet);

    event VoteCast(uint256 indexed electionId, uint256 indexed candidateId, address indexed voter, uint8 position);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier validPosition(uint8 _position) {
        require(_position <= YEAR_LEVEL_DEPARTMENT_REPRESENTATIVE, "Invalid position");
        _;
    }

    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].id != 0, "Election does not exist");
        _;
    }

    modifier candidateExists(uint256 _candidateId) {
        require(candidates[_candidateId].id != 0, "Candidate does not exist");
        _;
    }

    modifier electionOpen(uint256 _electionId) {
        Election storage e = elections[_electionId];
        require(e.isActive, "Election inactive");
        require(block.timestamp >= e.startDate, "Election not started");
        require(block.timestamp <= e.endDate, "Election ended");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    // =========================
    // STUDENTS
    // =========================

    function registerStudent(
        string calldata _studentId,
        string calldata _name,
        address _wallet
    ) external onlyAdmin {
        require(_wallet != address(0), "Invalid wallet");
        require(bytes(_studentId).length > 0, "Student ID required");
        require(bytes(_name).length > 0, "Name required");
        require(!students[_wallet].isRegistered, "Wallet already registered");

        bytes32 studentKey = keccak256(abi.encodePacked(_studentId));
        require(studentIdToWallet[studentKey] == address(0), "Student ID already used");

        students[_wallet] = Student({
            studentId: _studentId,
            name: _name,
            isRegistered: true,
            isActive: true
        });

        studentIdToWallet[studentKey] = _wallet;

        emit StudentRegistered(_studentId, _name, _wallet);
    }

    function updateStudentWallet(
        address _oldWallet,
        address _newWallet
    ) external onlyAdmin {
        require(_newWallet != address(0), "Invalid wallet");
        require(students[_oldWallet].isRegistered, "Old wallet not registered");
        require(!students[_newWallet].isRegistered, "New wallet already registered");

        Student memory s = students[_oldWallet];
        students[_newWallet] = s;
        delete students[_oldWallet];

        bytes32 studentKey = keccak256(abi.encodePacked(s.studentId));
        studentIdToWallet[studentKey] = _newWallet;

        emit StudentWalletUpdated(_oldWallet, _newWallet, s.studentId);
    }

    function setStudentStatus(
        address _wallet,
        bool _isActive
    ) external onlyAdmin {
        require(students[_wallet].isRegistered, "Student not registered");
        students[_wallet].isActive = _isActive;

        emit StudentStatusUpdated(_wallet, _isActive);
    }

    // =========================
    // ELECTIONS
    // =========================

    function createElection(
        string calldata _title,
        uint256 _startDate,
        uint256 _endDate
    ) external onlyAdmin returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(_startDate < _endDate, "Invalid dates");
        require(_endDate > block.timestamp, "End must be in future");

        uint256 electionId = nextElectionId++;

        elections[electionId] = Election({
            id: electionId,
            title: _title,
            startDate: _startDate,
            endDate: _endDate,
            isActive: true
        });

        emit ElectionCreated(electionId, _title, _startDate, _endDate);
        return electionId;
    }

    function updateElectionStatus(
        uint256 _electionId,
        bool _isActive
    ) external onlyAdmin electionExists(_electionId) {
        elections[_electionId].isActive = _isActive;
        emit ElectionStatusUpdated(_electionId, _isActive);
    }

    function getElectionCount() external view returns (uint256) {
        return nextElectionId - 1;
    }

    // =========================
    // WHITELIST
    // =========================

    function whitelistVoter(
        uint256 _electionId,
        address _wallet
    ) external onlyAdmin electionExists(_electionId) {
        require(students[_wallet].isRegistered, "Student not registered");
        require(students[_wallet].isActive, "Student inactive");

        isWhitelistedVoter[_electionId][_wallet] = true;
        emit VoterWhitelisted(_electionId, _wallet);
    }

    function removeWhitelistedVoter(
        uint256 _electionId,
        address _wallet
    ) external onlyAdmin electionExists(_electionId) {
        isWhitelistedVoter[_electionId][_wallet] = false;
        emit VoterRemovedFromWhitelist(_electionId, _wallet);
    }

    // =========================
    // CANDIDATES
    // =========================

    function registerCandidate(
        uint256 _electionId,
        string calldata _name,
        uint8 _position
    )
        external
        onlyAdmin
        electionExists(_electionId)
        validPosition(_position)
        returns (uint256)
    {
        require(bytes(_name).length > 0, "Name required");
        require(block.timestamp < elections[_electionId].startDate, "Election already started");

        uint256 candidateId = nextCandidateId++;

        candidates[candidateId] = Candidate({
            id: candidateId,
            electionId: _electionId,
            name: _name,
            position: _position,
            voteCount: 0
        });

        candidateIdsByPosition[_electionId][_position].push(candidateId);

        emit CandidateRegistered(candidateId, _electionId, _name, _position);
        return candidateId;
    }

    function getCandidatesByPosition(
        uint256 _electionId,
        uint8 _position
    )
        external
        view
        electionExists(_electionId)
        validPosition(_position)
        returns (Candidate[] memory)
    {
        uint256[] storage ids = candidateIdsByPosition[_electionId][_position];
        Candidate[] memory result = new Candidate[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            result[i] = candidates[ids[i]];
        }

        return result;
    }

    // =========================
    // VOTING
    // =========================

    function castVote(
        uint256 _electionId,
        uint256 _candidateId
    )
        external
        electionExists(_electionId)
        electionOpen(_electionId)
        candidateExists(_candidateId)
    {
        Student storage student = students[msg.sender];
        require(student.isRegistered, "Student not registered");
        require(student.isActive, "Student inactive");
        require(isWhitelistedVoter[_electionId][msg.sender], "Not whitelisted");

        Candidate storage candidate = candidates[_candidateId];
        require(candidate.electionId == _electionId, "Candidate not in election");

        require(
            !hasVotedPerPosition[_electionId][candidate.position][msg.sender],
            "Already voted for this position"
        );

        hasVotedPerPosition[_electionId][candidate.position][msg.sender] = true;
        candidate.voteCount += 1;

        emit VoteCast(_electionId, _candidateId, msg.sender, candidate.position);
    }

    // =========================
    // VIEW HELPERS
    // =========================

    function isEligibleVoter(
        uint256 _electionId,
        address _wallet
    ) external view returns (bool) {
        return
            students[_wallet].isRegistered &&
            students[_wallet].isActive &&
            isWhitelistedVoter[_electionId][_wallet];
    }

    function hasStudentVotedForPosition(
        uint256 _electionId,
        uint8 _position,
        address _wallet
    ) external view validPosition(_position) returns (bool) {
        return hasVotedPerPosition[_electionId][_position][_wallet];
    }

    function getResultsByPosition(
        uint256 _electionId,
        uint8 _position
    )
        external
        view
        electionExists(_electionId)
        validPosition(_position)
        returns (
            uint256[] memory candidateIds,
            string[] memory names,
            uint256[] memory voteCounts
        )
    {
        uint256[] storage ids = candidateIdsByPosition[_electionId][_position];

        candidateIds = new uint256[](ids.length);
        names = new string[](ids.length);
        voteCounts = new uint256[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            Candidate storage c = candidates[ids[i]];
            candidateIds[i] = c.id;
            names[i] = c.name;
            voteCounts[i] = c.voteCount;
        }

        return (candidateIds, names, voteCounts);
    }

    function positionName(uint8 _position) external pure validPosition(_position) returns (string memory) {
        if (_position == PRESIDENT) return "President";
        if (_position == VICE_PRESIDENT) return "Vice President";
        if (_position == SECRETARY) return "Secretary";
        if (_position == TREASURER) return "Treasurer";
        if (_position == AUDITOR) return "Auditor";
        if (_position == PRO_COMMUNICATIONS) return "PRO / Communications";
        if (_position == BUSINESS_MANAGER_FINANCE_OFFICER) return "Business Manager / Finance Officer";
        if (_position == ACADEMIC_AFFAIRS_OFFICER) return "Academic Affairs Officer";
        if (_position == STUDENT_WELFARE_OFFICER) return "Student Welfare Officer";
        return "Year-level / Department Representatives";
    }
}
