import { useState, useEffect } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import styles from '../styles/VaultDashboard.module.css';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useVault } from '../hooks/useVault';
import { formatEther } from 'viem';

// WETH Sepolia address
const WETH_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';

const VaultDashboard = () => {
  const { address, isConnected } = useAccount();
  const [depositAmount, setDepositAmount] = useState('');
  const [mintAmount, setMintAmount] = useState('');
  const [burnAmount, setBurnAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [activeTab, setActiveTab] = useState('supply');
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Get native ETH balance
  const { data: ethBalance, isLoading: isLoadingEthBalance } = useBalance({
    address,
  });

  // Get WETH balance
  const { data: wethBalance, isLoading: isLoadingWethBalance } = useBalance({
    address,
    token: WETH_ADDRESS,
  });

  // Debug log balances
  useEffect(() => {
    if (ethBalance) {
      console.log('ETH Balance:', formatEther(ethBalance.value));
    }
    if (wethBalance) {
      console.log('WETH Balance:', formatEther(wethBalance.value));
    }
  }, [ethBalance, wethBalance]);

  const {
    collateralBalance,
    collateralUSDValue,
    mintedBalance,
    currentETHPrice,
    liquidationPrice,
    deposit,
    withdraw,
    mint,
    burn,
    isDepositLoading,
    isWithdrawLoading,
    isMintLoading,
    isBurnLoading,
    isDepositSuccess,
    isWithdrawSuccess,
    isMintSuccess,
    isBurnSuccess,
    isLoadingCollateral,
    isLoadingMinted,
    availableToMint,
    currentLTV,
    maxLTV,
    liquidationThreshold
  } = useVault();

  // Theme toggle handler
  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.setAttribute('data-theme', !isDarkMode ? 'dark' : 'light');
  };

  // Set initial theme and mounted state
  useEffect(() => {
    setMounted(true);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  }, []);

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  // Mock data for the vault statistics
  const vaultStats = {
    collateralRatio: '200%',
    liquidationPrice: '$1,200',
    minCollateralRatio: '150%',
    ethPrice: '$2,500',
    liquidationThreshold: '$1,875',
  };

  const handleDeposit = async () => {
    if (!depositAmount) return;
    if (!address) {
      console.error('Wallet not connected');
      return;
    }
    
    setLastAction('supply');
    try {
      await deposit(depositAmount);
      setDepositAmount('');
    } catch (error) {
      console.error('Error depositing:', error);
    }
  };

  const handleMint = async () => {
    if (!mintAmount) return;
    setLastAction('mint');
    try {
      await mint(mintAmount);
      setMintAmount('');
    } catch (error) {
      console.error('Error minting:', error);
    }
  };

  const handleBurn = async () => {
    if (!burnAmount) return;
    setLastAction('burn');
    try {
      await burn(burnAmount);
      setBurnAmount('');
    } catch (error) {
      console.error('Error burning:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    setLastAction('withdraw');
    try {
      await withdraw(withdrawAmount);
      setWithdrawAmount('');
    } catch (error) {
      console.error('Error withdrawing:', error);
    }
  };

  const handleMaxDeposit = () => {
    if (wethBalance) {
      setDepositAmount(formatEther(wethBalance.value));
    }
  };

  const handleMaxMint = () => {
    if (!collateralBalance || !currentETHPrice || !maxLTV || !mintedBalance) return;

    try {
      // Convert string values to numbers for calculation
      const collateralETH = parseFloat(collateralBalance);
      const ethPrice = parseFloat(currentETHPrice);
      const maxLTVPercent = parseFloat(maxLTV);
      const currentMinted = parseFloat(mintedBalance);

      // Calculate available to mint: collateral * price * maxLTV - minted
      const availableToMint = (collateralETH * ethPrice * (maxLTVPercent/100)) - currentMinted;
      
      // Ensure we don't set a negative value
      const safeAvailableToMint = Math.max(0, availableToMint);
      
      // Round to 6 decimal places to avoid floating point precision issues
      setMintAmount(safeAvailableToMint.toFixed(6));
    } catch (error) {
      console.error('Error calculating max mint:', error);
      setMintAmount('0');
    }
  };

  const handleMaxBurn = () => {
    if (mintedBalance) {
      setBurnAmount(mintedBalance);
    }
  };

  const handleMaxWithdraw = () => {
    if (!collateralBalance || !mintedBalance || !currentETHPrice || !maxLTV) return;

    try {
      // Convert string values to numbers for calculation
      const currentCollateral = parseFloat(collateralBalance);
      const currentMinted = parseFloat(mintedBalance);
      const ethPrice = parseFloat(currentETHPrice);
      const maxLTVPercent = parseFloat(maxLTV);

      // Formula: minted <= (collateral - maxWithdraw) * price * (maxLTV/100)
      // Rearranging to solve for maxWithdraw:
      // minted <= (collateral - maxWithdraw) * price * (maxLTV/100)
      // minted / (price * (maxLTV/100)) <= collateral - maxWithdraw
      // collateral - minted / (price * (maxLTV/100)) >= maxWithdraw
      
      const maxWithdraw = currentCollateral - (currentMinted / (ethPrice * (maxLTVPercent/100)));
      
      // Ensure we don't set a negative value
      const safeMaxWithdraw = Math.max(0, maxWithdraw);
      
      // Round to 6 decimal places to avoid floating point precision issues
      setWithdrawAmount(safeMaxWithdraw.toFixed(6));
    } catch (error) {
      console.error('Error calculating max withdraw:', error);
      setWithdrawAmount('0');
    }
  };

  const getButtonText = (action: string, amount: string, isLoading: boolean, isSuccess: boolean) => {
    if (isLoading) {
      return 'Processing...';
    }
    if (isSuccess && lastAction === action) {
      return 'Success!';
    }
    if (!amount) {
      return `Enter amount to ${action}`;
    }
    return action.charAt(0).toUpperCase() + action.slice(1);
  };

  const renderActionPanel = () => {
    const getBalanceText = () => {
      switch (activeTab) {
        case 'supply':
          return wethBalance ? `Available: ${formatEther(wethBalance.value)} WETH` : 'Available: 0 WETH';
        case 'withdraw':
          if (!collateralBalance || !mintedBalance || !currentETHPrice || !maxLTV) return 'Available: 0 WETH';
          try {
            // Convert string values to numbers for calculation
            const currentCollateral = parseFloat(collateralBalance);
            const currentMinted = parseFloat(mintedBalance);
            const ethPrice = parseFloat(currentETHPrice);
            const maxLTVPercent = parseFloat(maxLTV);

            // Calculate max withdraw amount
            const requiredCollateral = (currentMinted / (ethPrice * (maxLTVPercent/100)));
            const availableWithdraw = Math.max(0, currentCollateral - requiredCollateral);
            
            return `Available: ${availableWithdraw.toFixed(6)} WETH`;
          } catch (error) {
            console.error('Error calculating available withdraw:', error);
            return 'Available: 0 WETH';
          }
        case 'mint':
          if (!collateralBalance || !currentETHPrice || !maxLTV || !mintedBalance) return 'Available: 0 USDH';
          try {
            // Use the same calculation as handleMaxMint
            const collateralETH = parseFloat(collateralBalance);
            const ethPrice = parseFloat(currentETHPrice);
            const maxLTVPercent = parseFloat(maxLTV);
            const currentMinted = parseFloat(mintedBalance);

            // Calculate available to mint: collateral * price * maxLTV - minted
            const availableToMint = (collateralETH * ethPrice * (maxLTVPercent/100)) - currentMinted;
            
            // Ensure we don't show a negative value
            const safeAvailableToMint = Math.max(0, availableToMint);
            
            return `Available: ${safeAvailableToMint.toFixed(6)} USDH`;
          } catch (error) {
            console.error('Error calculating available to mint:', error);
            return 'Available: 0 USDH';
          }
        case 'burn':
          return `Available: ${mintedBalance} USDH`;
        default:
          return '';
      }
    };

    const getTokenInfo = () => {
      switch (activeTab) {
        case 'supply':
        case 'withdraw':
          return {
            symbol: 'WETH',
            icon: '/images/eth-logo.svg',
            alt: 'Ethereum Logo'
          };
        case 'mint':
        case 'burn':
          return {
            symbol: 'USDH',
            icon: '/images/usdh-icon.png',
            alt: 'USDH Logo'
          };
      }
    };

    const renderInput = (value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, onMax: () => void, isLoading: boolean) => (
      <div className={styles.inputContainer}>
        <div className={styles.inputHeader}>
          <span>Amount</span>
          <div className={styles.balanceInfo}>
            {getBalanceText()}
            <button 
              className={styles.maxButtonSmall}
              onClick={onMax}
              type="button"
              disabled={isLoading}
            >
              MAX
            </button>
          </div>
        </div>
        <div className={styles.enhancedInputWrapper}>
              <input
                type="number"
            placeholder="Enter amount"
            value={value}
            onChange={onChange}
            className={styles.enhancedInput}
            disabled={isLoading}
          />
          <div className={styles.tokenDisplay}>
            <img 
              src={getTokenInfo()?.icon} 
              alt={getTokenInfo()?.alt} 
              className={styles.tokenIcon}
            />
            <span className={styles.tokenSymbol}>{getTokenInfo()?.symbol}</span>
          </div>
        </div>
      </div>
    );

    switch (activeTab) {
      case 'supply':
        return (
          <div className={styles.actionPanel}>
            <h3>Supply Collateral</h3>
            <p className={styles.description}>
              Supply WETH as collateral to mint USDH.
            </p>
            {renderInput(
              depositAmount,
              (e) => setDepositAmount(e.target.value),
              handleMaxDeposit,
              isDepositLoading
            )}
            <button 
              onClick={handleDeposit}
              className={styles.actionButton}
              disabled={!depositAmount || isDepositLoading}
            >
              {getButtonText('supply', depositAmount, isDepositLoading, isDepositSuccess)}
            </button>
          </div>
        );

      case 'withdraw':
        return (
          <div className={styles.actionPanel}>
            <h3>Withdraw</h3>
            <p className={styles.description}>
              Withdraw your WETH collateral.
            </p>
            {renderInput(
              withdrawAmount,
              (e) => setWithdrawAmount(e.target.value),
              handleMaxWithdraw,
              isWithdrawLoading
            )}
            <button 
              onClick={handleWithdraw}
              className={styles.actionButton}
              disabled={!withdrawAmount || isWithdrawLoading}
            >
              {getButtonText('withdraw', withdrawAmount, isWithdrawLoading, isWithdrawSuccess)}
            </button>
          </div>
        );

      case 'mint':
        return (
          <div className={styles.actionPanel}>
            <h3>Mint USDH</h3>
            <p className={styles.description}>
              Mint USDH against your deposited collateral.
            </p>
            {renderInput(
              mintAmount,
              (e) => setMintAmount(e.target.value),
              handleMaxMint,
              isMintLoading
            )}
            <button 
              onClick={handleMint}
              className={styles.actionButton}
              disabled={!mintAmount || isMintLoading}
            >
              {getButtonText('mint', mintAmount, isMintLoading, isMintSuccess)}
            </button>
          </div>
        );

      case 'burn':
        return (
          <div className={styles.actionPanel}>
            <h3>Burn USDH</h3>
            <p className={styles.description}>
              Burn USDH to reduce your debt position.
            </p>
            {renderInput(
              burnAmount,
              (e) => setBurnAmount(e.target.value),
              handleMaxBurn,
              isBurnLoading
            )}
            <button 
              onClick={handleBurn}
              className={styles.actionButton}
              disabled={!burnAmount || isBurnLoading}
            >
              {getButtonText('burn', burnAmount, isBurnLoading, isBurnSuccess)}
              </button>
          </div>
        );

      default:
        return null;
    }
  };

  const renderCollateralCard = () => (
    <div className={`${styles.statCard} ${styles.glassEffect}`}>
      <div className={styles.statCardInner}>
        <h4>Collateral Deposited</h4>
        <div className={`${styles.statValue} ${isLoadingCollateral ? styles.loading : ''}`}>
          {isLoadingCollateral ? 'Loading...' : (
            <>
              <div className={styles.tokenAmount}>
                <img 
                  src="/images/eth-logo.svg" 
                  alt="Ethereum Logo" 
                  className={styles.tokenIconSmall}
                />
                <span>{collateralBalance} <span style={{ fontSize: '1rem' }}>WETH</span></span>
              </div>
              <div className={styles.usdValue}>
                ${collateralUSDValue} USD
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderLiquidationCard = () => (
    <div className={`${styles.statCard} ${styles.glassEffect}`}>
      <div className={styles.statCardInner}>
        <h4>Liquidation Price</h4>
        <div className={styles.statValue}>
          <div>
            ${liquidationPrice} USD
          </div>
          <div className={styles.usdValue}>
            Current: ${currentETHPrice} USD
          </div>
        </div>
      </div>
    </div>
  );

  const renderUSDHMintedCard = () => (
    <div className={`${styles.statCard} ${styles.glassEffect}`}>
      <div className={styles.statCardInner}>
        <h4>USDH Minted</h4>
        <div className={`${styles.statValue} ${isLoadingMinted ? styles.loading : ''}`}>
          {isLoadingMinted ? 'Loading...' : mintedBalance} <span style={{ fontSize: '1rem' }}>USDH</span>
        </div>
      </div>
    </div>
  );

  const renderHealthStatusCard = () => {
    const currentLTVNum = Number(currentLTV);
    const maxLTVNum = Number(maxLTV);
    const liquidationThresholdNum = Number(liquidationThreshold);
    
    let healthStatus = 'Healthy';
    let healthClass = styles.healthyZone;
    let healthMessage = 'Your position is healthy. You can safely borrow more USDH against your collateral.';
    let healthIcon = '✓';
    
    if (currentLTVNum >= liquidationThresholdNum) {
      healthStatus = 'Liquidatable';
      healthClass = styles.dangerZone;
      healthMessage = 'URGENT: Your position is at risk of liquidation. Repay USDH or add collateral immediately to avoid liquidation.';
      healthIcon = '⚠️';
    } else if (currentLTVNum >= maxLTVNum) {
      healthStatus = 'Warning';
      healthClass = styles.warningZone;
      healthMessage = 'Your position is above the maximum LTV. You cannot borrow more and are approaching liquidation territory.';
      healthIcon = '⚠️';
    }

    return (
      <div className={`${styles.healthStatusCard} ${styles.glassEffect}`}>
        <div className={styles.healthStatusHeader}>
          <h3>Position Health</h3>
          <div className={healthClass} data-tooltip={healthMessage}>
            <span>{healthIcon}</span>
            {healthStatus}
          </div>
        </div>
        
        <div className={styles.healthStatusContent}>
          <div className={styles.ltvBarContainer}>
            <div className={styles.ltvBarWrapper}>
              <div className={styles.ltvBar}>
                <div 
                  className={styles.currentLtvMarker}
                  style={{ left: `${currentLTVNum}%` }}
                >
                  <span className={styles.currentLtvLabel}>Current: {currentLTVNum}%</span>
                </div>
              </div>
              
              <div 
                className={styles.maxLtvMarker}
                style={{ left: `${maxLTVNum}%` }}
              >
                <span className={styles.markerLabel}>Max LTV {maxLTVNum}%</span>
                <div className={styles.markerLine} />
              </div>
              
              <div 
                className={styles.liquidationMarker}
                style={{ left: `${liquidationThresholdNum}%` }}
              >
                <span className={styles.markerLabel}>Liquidation {liquidationThresholdNum}%</span>
                <div className={styles.markerLine} />
              </div>
            </div>
          </div>
          
          <div className={styles.healthMetrics}>
            <div className={styles.metric}>
              <span>Current LTV</span>
              <strong>{currentLTVNum}%</strong>
            </div>
            <div className={styles.metric}>
              <span>Max LTV</span>
              <strong>{maxLTVNum}%</strong>
            </div>
            <div className={styles.metric}>
              <span>Liquidation Threshold</span>
              <strong>{liquidationThresholdNum}%</strong>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.dashboard} ${isDarkMode ? styles.darkMode : ''}`}>
      <div className={styles.cloudLayer} />
      <div className={styles.header}>
        <h1>Suq</h1>
        <div className={styles.headerControls}>
          <button
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <div className={styles.themeToggleInner}>
              <FiSun />
              <FiMoon />
              <div className={`${styles.themeToggleHandle} ${isDarkMode ? styles.darkHandle : ''}`} />
            </div>
          </button>
          <ConnectButton />
        </div>
      </div>

      <div className={styles.content}>
        {isConnected ? (
          <>
            <div className={styles.dashboardLayout}>
              {/* Top Row - Three Cards */}
              <div className={styles.topRow}>
                {renderCollateralCard()}
                {renderUSDHMintedCard()}
                {renderLiquidationCard()}
              </div>

              {/* Bottom Row - Actions and Health */}
              <div className={styles.bottomRow}>
                <div className={`${styles.vaultActions} ${styles.glassEffect}`}>
                  <div className={styles.tabs}>
                    {['supply', 'withdraw', 'mint', 'burn'].map((tab) => (
                      <button
                        key={tab}
                        className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab)}
                        disabled={
                          isDepositLoading || isWithdrawLoading || 
                          isMintLoading || isBurnLoading
                        }
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                  {renderActionPanel()}
                </div>
                {renderHealthStatusCard()}
              </div>
            </div>
          </>
        ) : (
          <div className={`${styles.connectPrompt} ${styles.glassEffect}`}>
            <h2>Welcome to Suq</h2>
            <div className={styles.connectDescription}>
              <p className={styles.mainDescription}>
                Suq lets you mint USDH, an interest-free stablecoin that maintains a 1:1 peg with USD, backed entirely by ETH collateral.
              </p>
              <div className={styles.featuresList}>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>🔒</span>
                  <span>Secure: Fully backed by ETH collateral</span>
                </div>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>💸</span>
                  <span>Interest-free: No borrowing fees</span>
                </div>
                <div className={styles.feature}>
                  <span className={styles.featureIcon}>⚡</span>
                  <span>Efficient: Mint USDH instantly against your ETH</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VaultDashboard; 