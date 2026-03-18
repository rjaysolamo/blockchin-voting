// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title BlockchainVoting
 * @author Rjay Solamo
 * @notice A secure, transparent voting system on Ethereum blockchain
 * @dev This contract handles election creation, candidate registration, and vote casting
 * with built-in security features and audit capabilities
 */
contract BlockchainVoting {
        
    struct Election {
        uint256 id;
        string title;
        string description;
        uint256 startDate;
        uint256 endDate;
        bool isActive;
        uint256 createdAt;
        uint256 updatedAt;
    }
    
    struct Candidate {
        uint256 id;
        uint256 electionId;
        string name;
        string position;
        string department;
        string yearLevel;
        string photoUrl;
        string manifesto;
        uint256 voteCount;
        uint256 createdAt;
    }
    
    struct VoteBlock {
        uint256 blockNumber;
        bytes32 previousHash;
        bytes32 currentHash;
        address voter;
        uint256 candidateId;
        uint256 electionId;
        string position;
        uint256 timestamp;
        uint256 nonce;
        string verificationCode;
    }
    
    struct AuditLog {
        uint256 id;
        uint256 electionId;
        string action;
        bytes32 blockHash;
        uint256 blockNumber;
        string position;
        uint256 timestamp;
        string details;
    }
    
    // ============ STATE VARIABLES ============
    
    address public admin;
    uint256 private nextElectionId = 1;
    uint256 private nextCandidateId = 1;
    uint256 private nextVoteBlockNumber = 1;
    uint256 private nextAuditLogId = 1;
    
    bytes32 public lastBlockHash;
    
    mapping(uint256 => Election) public elections;
    mapping(uint256 => Candidate) public candidates;
    mapping(uint256 => VoteBlock) public voteBlocks;
    mapping(uint256 => AuditLog) public auditLogs;
    
    // Track which voters have voted in which elections
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    
    // Track candidate vote counts per election
    mapping(uint256 => mapping(uint256 => uint256)) public candidateVotes;
    
    // ============ EVENTS ============
    
    event ElectionCreated(uint256 indexed electionId, string title, uint256 startDate, uint256 endDate);
    event ElectionUpdated(uint256 indexed electionId, bool isActive);
    event CandidateRegistered(uint256 indexed candidateId, uint256 electionId, string name, string position);
    event VoteCast(
        uint256 indexed blockNumber,
        address indexed voter,
        uint256 electionId,
        uint256 candidateId,
        bytes32 voteHash,
        string verificationCode
    );
    event AuditLogCreated(uint256 indexed logId, uint256 electionId, string action, bytes32 blockHash);
    
    // ============ MODIFIERS ============
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }
    
    modifier electionExists(uint256 _electionId) {
        require(elections[_electionId].id != 0, "Election does not exist");
        _;
    }
    
    modifier electionActive(uint256 _electionId) {
        require(elections[_electionId].isActive, "Election is not active");
        require(block.timestamp >= elections[_electionId].startDate, "Election has not started");
        require(block.timestamp <= elections[_electionId].endDate, "Election has ended");
        _;
    }
    
    modifier candidateExists(uint256 _candidateId) {
        require(candidates[_candidateId].id != 0, "Candidate does not exist");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor() {
        admin = msg.sender;
        lastBlockHash = keccak256(abi.encodePacked("GENESIS_BLOCK"));
        
        // Create initial audit log for contract deployment
        _createAuditLog(0, "CONTRACT_DEPLOYED", bytes32(0), 0, "", "Contract deployed successfully");
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @dev Create a new election
     * @param _title Election title
     * @param _description Election description
     * @param _startDate Election start timestamp
     * @param _endDate Election end timestamp
     */
    function createElection(
        string memory _title,
        string memory _description,
        uint256 _startDate,
        uint256 _endDate
    ) external onlyAdmin returns (uint256) {
        require(_startDate < _endDate, "Start date must be before end date");
        require(_endDate > block.timestamp, "End date must be in the future");
        
        uint256 electionId = nextElectionId++;
        
        elections[electionId] = Election({
            id: electionId,
            title: _title,
            description: _description,
            startDate: _startDate,
            endDate: _endDate,
            isActive: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        emit ElectionCreated(electionId, _title, _startDate, _endDate);
        _createAuditLog(electionId, "ELECTION_CREATED", bytes32(0), 0, "", 
            string(abi.encodePacked("Election created: ", _title)));
        
        return electionId;
    }
    
    /**
     * @dev Update election status
     * @param _electionId Election ID
     * @param _isActive Whether election is active
     */
    function updateElectionStatus(
        uint256 _electionId,
        bool _isActive
    ) external onlyAdmin electionExists(_electionId) {
        elections[_electionId].isActive = _isActive;
        elections[_electionId].updatedAt = block.timestamp;
        
        emit ElectionUpdated(_electionId, _isActive);
        _createAuditLog(_electionId, "ELECTION_UPDATED", bytes32(0), 0, "", 
            string(abi.encodePacked("Election status updated to: ", _isActive ? "active" : "inactive")));
    }
    
    /**
     * @dev Register a candidate for an election
     * @param _electionId Election ID
     * @param _name Candidate name
     * @param _position Position candidate is running for
     * @param _department Candidate department
     * @param _yearLevel Candidate year level
     * @param _photoUrl Candidate photo URL
     * @param _manifesto Candidate manifesto
     */
    function registerCandidate(
        uint256 _electionId,
        string memory _name,
        string memory _position,
        string memory _department,
        string memory _yearLevel,
        string memory _photoUrl,
        string memory _manifesto
    ) external onlyAdmin electionExists(_electionId) returns (uint256) {
        uint256 candidateId = nextCandidateId++;
        
        candidates[candidateId] = Candidate({
            id: candidateId,
            electionId: _electionId,
            name: _name,
            position: _position,
            department: _department,
            yearLevel: _yearLevel,
            photoUrl: _photoUrl,
            manifesto: _manifesto,
            voteCount: 0,
            createdAt: block.timestamp
        });
        
        emit CandidateRegistered(candidateId, _electionId, _name, _position);
        _createAuditLog(_electionId, "CANDIDATE_REGISTERED", bytes32(0), 0, _position, 
            string(abi.encodePacked("Candidate registered: ", _name)));
        
        return candidateId;
    }
    
    // ============ VOTING FUNCTIONS ============
    
    /**
     * @dev Cast a vote in an election
     * @param _electionId Election ID
     * @param _candidateId Candidate ID
     * @param _position Position being voted for
     */
    function castVote(
        uint256 _electionId,
        uint256 _candidateId,
        string memory _position
    ) external electionExists(_electionId) electionActive(_electionId) candidateExists(_candidateId) {
        require(!hasVoted[_electionId][msg.sender], "Voter has already voted in this election");
        require(candidates[_candidateId].electionId == _electionId, "Candidate not in this election");
        
        // Generate verification code
        string memory verificationCode = _generateVerificationCode();
        
        // Create vote block
        uint256 nonce = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, _candidateId)));
        bytes32 voteHash = _calculateVoteHash(
            lastBlockHash,
            msg.sender,
            _candidateId,
            _electionId,
            _position,
            block.timestamp,
            nonce
        );
        
        uint256 blockNumber = nextVoteBlockNumber++;
        
        voteBlocks[blockNumber] = VoteBlock({
            blockNumber: blockNumber,
            previousHash: lastBlockHash,
            currentHash: voteHash,
            voter: msg.sender,
            candidateId: _candidateId,
            electionId: _electionId,
            position: _position,
            timestamp: block.timestamp,
            nonce: nonce,
            verificationCode: verificationCode
        });
        
        // Update state
        lastBlockHash = voteHash;
        hasVoted[_electionId][msg.sender] = true;
        candidates[_candidateId].voteCount++;
        candidateVotes[_electionId][_candidateId]++;
        
        emit VoteCast(blockNumber, msg.sender, _electionId, _candidateId, voteHash, verificationCode);
        _createAuditLog(_electionId, "VOTE_CAST", voteHash, blockNumber, _position, 
            string(abi.encodePacked("Vote cast for candidate: ", candidates[_candidateId].name)));
    }
    
    /**
     * @dev Verify a vote using verification code
     * @param _blockNumber Vote block number
     * @param _verificationCode Verification code
     */
    function verifyVote(
        uint256 _blockNumber,
        string memory _verificationCode
    ) external view returns (bool) {
        require(voteBlocks[_blockNumber].blockNumber != 0, "Vote block does not exist");
        
        VoteBlock memory vote = voteBlocks[_blockNumber];
        
        return keccak256(abi.encodePacked(_verificationCode)) == 
               keccak256(abi.encodePacked(vote.verificationCode));
    }
    
    /**
     * @dev Get election results
     * @param _electionId Election ID
     */
    function getElectionResults(uint256 _electionId) 
        external 
        view 
        electionExists(_electionId) 
        returns (uint256[] memory candidateIds, uint256[] memory voteCounts) 
    {
        uint256 candidateCount = 0;
        
        // Count candidates in this election
        for (uint256 i = 1; i < nextCandidateId; i++) {
            if (candidates[i].electionId == _electionId) {
                candidateCount++;
            }
        }
        
        candidateIds = new uint256[](candidateCount);
        voteCounts = new uint256[](candidateCount);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextCandidateId; i++) {
            if (candidates[i].electionId == _electionId) {
                candidateIds[index] = candidates[i].id;
                voteCounts[index] = candidates[i].voteCount;
                index++;
            }
        }
        
        return (candidateIds, voteCounts);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Get all elections
     */
    function getAllElections() external view returns (Election[] memory) {
        Election[] memory allElections = new Election[](nextElectionId - 1);
        
        for (uint256 i = 1; i < nextElectionId; i++) {
            allElections[i - 1] = elections[i];
        }
        
        return allElections;
    }
    
    /**
     * @dev Get candidates for an election
     * @param _electionId Election ID
     */
    function getCandidates(uint256 _electionId) 
        external 
        view 
        electionExists(_electionId) 
        returns (Candidate[] memory) 
    {
        uint256 candidateCount = 0;
        
        // Count candidates in this election
        for (uint256 i = 1; i < nextCandidateId; i++) {
            if (candidates[i].electionId == _electionId) {
                candidateCount++;
            }
        }
        
        Candidate[] memory electionCandidates = new Candidate[](candidateCount);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextCandidateId; i++) {
            if (candidates[i].electionId == _electionId) {
                electionCandidates[index] = candidates[i];
                index++;
            }
        }
        
        return electionCandidates;
    }
    
    /**
     * @dev Get vote history for a voter
     * @param _voter Voter address
     */
    function getVoteHistory(address _voter) external view returns (VoteBlock[] memory) {
        uint256 voteCount = 0;
        
        // Count votes by this voter
        for (uint256 i = 1; i < nextVoteBlockNumber; i++) {
            if (voteBlocks[i].voter == _voter) {
                voteCount++;
            }
        }
        
        VoteBlock[] memory voterVotes = new VoteBlock[](voteCount);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextVoteBlockNumber; i++) {
            if (voteBlocks[i].voter == _voter) {
                voterVotes[index] = voteBlocks[i];
                index++;
            }
        }
        
        return voterVotes;
    }
    
    /**
     * @dev Get audit logs for an election
     * @param _electionId Election ID
     */
    function getAuditLogs(uint256 _electionId) 
        external 
        view 
        electionExists(_electionId) 
        returns (AuditLog[] memory) 
    {
        uint256 logCount = 0;
        
        // Count logs for this election
        for (uint256 i = 1; i < nextAuditLogId; i++) {
            if (auditLogs[i].electionId == _electionId) {
                logCount++;
            }
        }
        
        AuditLog[] memory electionLogs = new AuditLog[](logCount);
        
        uint256 index = 0;
        for (uint256 i = 1; i < nextAuditLogId; i++) {
            if (auditLogs[i].electionId == _electionId) {
                electionLogs[index] = auditLogs[i];
                index++;
            }
        }
        
        return electionLogs;
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @dev Calculate vote hash (SHA-256 equivalent)
     */
    function _calculateVoteHash(
        bytes32 _previousHash,
        address _voter,
        uint256 _candidateId,
        uint256 _electionId,
        string memory _position,
        uint256 _timestamp,
        uint256 _nonce
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            _previousHash,
            _voter,
            _candidateId,
            _electionId,
            _position,
            _timestamp,
            _nonce
        ));
    }
    
    /**
     * @dev Generate verification code
     */
    function _generateVerificationCode() internal view returns (string memory) {
        bytes memory chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        bytes memory code = new bytes(12);
        
        for (uint256 i = 0; i < 12; i++) {
            if (i == 4 || i == 8) {
                code[i] = "-";
            } else {
                uint256 random = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, i))) % chars.length;
                code[i] = chars[random];
            }
        }
        
        return string(code);
    }
    
    /**
     * @dev Create audit log entry
     */
    function _createAuditLog(
        uint256 _electionId,
        string memory _action,
        bytes32 _blockHash,
        uint256 _blockNumber,
        string memory _position,
        string memory _details
    ) internal {
        uint256 logId = nextAuditLogId++;
        
        auditLogs[logId] = AuditLog({
            id: logId,
            electionId: _electionId,
            action: _action,
            blockHash: _blockHash,
            blockNumber: _blockNumber,
            position: _position,
            timestamp: block.timestamp,
            details: _details
        });
        
        emit AuditLogCreated(logId, _electionId, _action, _blockHash);
    }
}