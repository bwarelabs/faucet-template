// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title Faucet
 * @dev A smart contract that allows users to request tokens from a faucet with various eligibility conditions.
 * @dev The contract is upgradeable and includes access control and pausing functionality.
 */

contract Faucet is Initializable, AccessControlUpgradeable, PausableUpgradeable, UUPSUpgradeable {

    /* Access roles */

    /// @dev owner role of the contract and admin over all existing access-roles
    bytes32 internal constant OWNER_ROLE = keccak256("OWNER_ROLE");

    /// @dev access-role used for sending tokens from faucet
    bytes32 internal constant SENDER_ROLE = keccak256("SENDER_ROLE");

    enum RequestType{
        NORMAL_REQUEST,
        TWITTER_REQUEST
    }

    /**
     * @dev States of faucet eligibility.
     */
    enum FaucetEligibility {
        ALREADY_REQUESTED,
        HAS_TWEETED,
        DAILY_LIMIT_REACHED,
        OUT_OF_FUNDS,
        IS_ELIGIBLE
    }

    uint256 public normalRequestTokens;
    uint256 public twitterRequestTokens;
    uint256 public cooldownPeriod;
    uint256 public todaySpent;
    uint256 public todayDate;
    uint256 public dailyLimit;

    mapping(address => uint256) private lastRequestTimestamp;
    mapping(address => uint256) private lastRequestTwitterTimestamp;


    event DepositFunds(address indexed from, uint256 amount);
    event TokensSent(address indexed recipient, uint256 amount, RequestType indexed requestType);
    event FundsTransferred(address indexed owner, uint256 amount);
 
    /**
     * @dev Initializes the contract.
     * @param ownerAddress The address of the contract owner.
     * @param _normalRequestTokens The amount of tokens to be sent for a normal request.
     * @param _twitterRequestTokens The amount of tokens to be sent for a Twitter request.
     * @param _cooldownPeriod The cooldown period in seconds between requests.
     * @param _dailyLimit The daily limit of tokens that can be sent.
     */

    function initialize(
        address ownerAddress,
        uint256 _normalRequestTokens,
        uint256 _twitterRequestTokens,
        uint256 _cooldownPeriod,
        uint256 _dailyLimit
    ) public initializer {
        __UUPSUpgradeable_init();

        _setupRole(OWNER_ROLE, ownerAddress);
        _setRoleAdmin(OWNER_ROLE, OWNER_ROLE);
        _setRoleAdmin(SENDER_ROLE, OWNER_ROLE);


        // Set initial parameters
        normalRequestTokens = _normalRequestTokens;
        twitterRequestTokens = _twitterRequestTokens;
        cooldownPeriod = _cooldownPeriod;
        dailyLimit = _dailyLimit;
        todayDate = block.timestamp;

        // pause contract until entirely configured
        _pause();
    }


    function _authorizeUpgrade(address) internal override onlyRole(OWNER_ROLE) {}


    /**
     * @dev Receives Ether funds sent to the contract.
     */
    receive() external payable {
        emit DepositFunds(msg.sender, msg.value);
    }

    /**
     * @notice Pause contract: freeze its exposed API.
     * @dev Only the contract owner can call this function.
     */
    function pause() external onlyRole(OWNER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause contract.
     * @dev Only the contract owner can call this function.
     */
    function unpause() external onlyRole(OWNER_ROLE) {
        _unpause();
    }

    /**
     * @notice Retrieves the last request timestamp for a user.
     * @param userAccount The address of the user.
     * @return The last request timestamp for the specified user.
     */

    function getLastRequestTimestamp(address userAccount) external view returns (uint256) {
        return lastRequestTimestamp[userAccount];
    }

    /**
     * @notice Retrieves the last Twitter request timestamp for a user.
     * @param userAccount The address of the user.
     * @return The last Twitter request timestamp for the specified user.
     */
    function getLastRequestTwitterTimestamp(address userAccount) external view returns (uint256) {
        return lastRequestTwitterTimestamp[userAccount];
    }

     /**
     * @notice Requests tokens from the faucet.
     * @param user The address of the user making the request.
     * @param requestType The type of request (NORMAL_REQUEST or TWITTER_REQUEST).
     */
    function requestTokens(address user, RequestType requestType) external whenNotPaused onlyRole(SENDER_ROLE) {
        FaucetEligibility eligible = isEligibleForTokens(user, requestType);
        require(eligible == FaucetEligibility.IS_ELIGIBLE, Strings.toString(uint(eligible)));

        if (requestType == RequestType.TWITTER_REQUEST) {
            todaySpent += twitterRequestTokens;
            lastRequestTwitterTimestamp[user] = block.timestamp;

            payable(user).transfer(twitterRequestTokens);
            emit TokensSent(user, twitterRequestTokens, RequestType.TWITTER_REQUEST);
        }

        if (requestType == RequestType.NORMAL_REQUEST) {
            todaySpent += normalRequestTokens;
            lastRequestTimestamp[user] = block.timestamp;

            payable(user).transfer(normalRequestTokens);
            emit TokensSent(user, normalRequestTokens, RequestType.NORMAL_REQUEST);
        }
    }

    /**
     * @dev Checks the eligibility of a user for token requests.
     * @param user The address of the user.
     * @param requestType The type of request (NORMAL_REQUEST or TWITTER_REQUEST).
     * @return The eligibility status of the user.
     */
    function isEligibleForTokens(address user, RequestType requestType) private returns (FaucetEligibility){
        require(user != address(0), "Invalid address");

        checkDayChanged();

        if (requestType == RequestType.TWITTER_REQUEST) {
            if (lastRequestTwitterTimestamp[user] + cooldownPeriod > block.timestamp) {
                return FaucetEligibility.HAS_TWEETED;
            }
            if (todaySpent + twitterRequestTokens > dailyLimit) {
                return FaucetEligibility.DAILY_LIMIT_REACHED;
            }
            if (address(this).balance < twitterRequestTokens) {
                return FaucetEligibility.OUT_OF_FUNDS;
            }
        }

        if (requestType == RequestType.NORMAL_REQUEST) {
            if (lastRequestTimestamp[user]+cooldownPeriod > block.timestamp) {
                return FaucetEligibility.ALREADY_REQUESTED;
            }
            if (todaySpent + normalRequestTokens > dailyLimit) {
                return FaucetEligibility.DAILY_LIMIT_REACHED;
            }
            if (address(this).balance < normalRequestTokens) {
                return FaucetEligibility.OUT_OF_FUNDS;
            }
        }

        return FaucetEligibility.IS_ELIGIBLE;
    }

    /**
     * @notice Sets the amount of tokens to be sent for a normal request.
     * @dev Only the contract owner can call this function.
     * @param _normalRequestTokens The new amount in wei of tokens for a normal request.
     */
    function setNormalRequestTokens(uint256 _normalRequestTokens) external onlyRole(OWNER_ROLE) {
        require(_normalRequestTokens > 0, "Normal request amount to be transferred can not be 0");
        normalRequestTokens = _normalRequestTokens;
    }

    /**
     * @notice Sets the amount of tokens to be sent for a Twitter request.
     * @dev Only the contract owner can call this function.
     * @param _twitterRequestTokens The new amount of tokens for a Twitter request.
     */
    function setTwitterRequestTokens(uint256 _twitterRequestTokens) external onlyRole(OWNER_ROLE) {
        require(_twitterRequestTokens > 0, "Twitter request amount to be transferred can not be 0");
        twitterRequestTokens = _twitterRequestTokens;
    }

    /**
     * @notice Sets the cooldown period between the requests of a user.
     * @dev Only the contract owner can call this function.
     * @param _cooldownPeriod The new cooldown period in seconds.
     */
    function setCooldownPeriod(uint256 _cooldownPeriod) external onlyRole(OWNER_ROLE) {
        require(_cooldownPeriod > 0, "Cooldown period can not be 0");
        cooldownPeriod = _cooldownPeriod;
    }

    /**
     * @notice Sets the daily limit of tokens that can be sent.
     * @dev Only the contract owner can call this function.
     * @param _dailyLimit The new daily limit of tokens.
     */
    function setDailyLimit(uint256 _dailyLimit) external onlyRole(OWNER_ROLE) {
        require(_dailyLimit > 0, "Daily limit  can not be 0");
        dailyLimit = _dailyLimit;
    }

    /**
     * @dev Checks if a day has changed and resets the daily spent amount if needed.
     */
    function checkDayChanged() private {
        if (block.timestamp - 1 days > todayDate) {
            todayDate = block.timestamp;
            todaySpent = 0;
            if(dailyLimit > address(this).balance){
                dailyLimit = address(this).balance;
            }
        }
    }
    
    /**
     * @notice Retrieves the balance of the faucet contract.
     * @return The balance of the faucet contract in wei.
     */
    function getFaucetBalance() external view returns (uint256){
        return address(this).balance;
    }

    /**
     * @notice Transfers all the funds from the faucet contract to the specified owner.
     * @dev Only the contract owner can call this function.
     * @param owner The address of the recipient of the funds.
     */
    function transferAllFunds(address payable owner) external onlyRole(OWNER_ROLE) {
        owner.transfer(address(this).balance);
        emit FundsTransferred(owner, address(this).balance);
    }

    /**
     * @notice Retrieves metadata about the faucet contract.
     * @return The daily limit, today's spent amount, normal request tokens, and Twitter request tokens.
     */
    function getFaucetMetadata() external view returns (uint256, uint256,uint256,uint256) {
        if(block.timestamp - 1 days > todayDate){
            uint256 todaySpentReset = 0;
            return (dailyLimit, todaySpentReset,normalRequestTokens,twitterRequestTokens);
        }
        return (dailyLimit, todaySpent,normalRequestTokens,twitterRequestTokens);
    }
}