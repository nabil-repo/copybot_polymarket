// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CopyTradingVault
 * @notice Vault for managing copy trading funds with profit sharing
 */
contract CopyTradingVault is Ownable, ReentrancyGuard {
    IERC20 public immutable usdcToken;
    
    struct Deposit {
        uint256 amount;
        uint256 shares;
        uint256 depositTime;
    }
    
    struct TradeExecution {
        uint256 marketId;
        uint256 amount;
        uint256 timestamp;
        address executor;
    }
    
    mapping(address => Deposit) public deposits;
    mapping(address => bool) public authorizedTraders;
    
    uint256 public totalShares;
    uint256 public totalAssets;
    uint256 public performanceFee = 200; // 2% (basis points)
    uint256 public managementFee = 100; // 1% annual
    
    TradeExecution[] public tradeHistory;
    
    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 amount, uint256 shares);
    event TradeExecuted(uint256 indexed marketId, uint256 amount, address executor);
    event FeesCollected(uint256 performanceFee, uint256 managementFee);
    
    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }
    
    /**
     * @notice Deposit USDC into vault
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        uint256 shares;
        if (totalShares == 0) {
            shares = amount;
        } else {
            shares = (amount * totalShares) / totalAssets;
        }
        
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        
        deposits[msg.sender].amount += amount;
        deposits[msg.sender].shares += shares;
        deposits[msg.sender].depositTime = block.timestamp;
        
        totalShares += shares;
        totalAssets += amount;
        
        emit Deposited(msg.sender, amount, shares);
    }
    
    /**
     * @notice Withdraw USDC from vault
     */
    function withdraw(uint256 shares) external nonReentrant {
        require(shares > 0, "Shares must be > 0");
        require(deposits[msg.sender].shares >= shares, "Insufficient shares");
        
        uint256 amount = (shares * totalAssets) / totalShares;
        
        deposits[msg.sender].shares -= shares;
        totalShares -= shares;
        totalAssets -= amount;
        
        require(usdcToken.transfer(msg.sender, amount), "Transfer failed");
        
        emit Withdrawn(msg.sender, amount, shares);
    }
    
    /**
     * @notice Execute trade (only authorized traders)
     */
    function executeTrade(
        uint256 marketId,
        uint256 amount
    ) external nonReentrant {
        require(authorizedTraders[msg.sender], "Not authorized");
        require(amount <= totalAssets, "Insufficient funds");
        
        tradeHistory.push(TradeExecution({
            marketId: marketId,
            amount: amount,
            timestamp: block.timestamp,
            executor: msg.sender
        }));
        
        emit TradeExecuted(marketId, amount, msg.sender);
    }
    
    /**
     * @notice Get user's current value
     */
    function getUserValue(address user) external view returns (uint256) {
        if (totalShares == 0) return 0;
        return (deposits[user].shares * totalAssets) / totalShares;
    }
    
    /**
     * @notice Authorize trader
     */
    function authorizeTrader(address trader) external onlyOwner {
        authorizedTraders[trader] = true;
    }
    
    /**
     * @notice Revoke trader authorization
     */
    function revokeTrader(address trader) external onlyOwner {
        authorizedTraders[trader] = false;
    }
    
    /**
     * @notice Update fees
     */
    function updateFees(uint256 _performanceFee, uint256 _managementFee) external onlyOwner {
        require(_performanceFee <= 1000, "Fee too high"); // Max 10%
        require(_managementFee <= 500, "Fee too high"); // Max 5%
        performanceFee = _performanceFee;
        managementFee = _managementFee;
    }
    
    /**
     * @notice Get trade history length
     */
    function getTradeHistoryLength() external view returns (uint256) {
        return tradeHistory.length;
    }
}
