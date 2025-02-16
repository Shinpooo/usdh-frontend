import { useAccount, useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi';
import { CONTRACT_CONFIG } from '../config/contracts';
import { parseEther, formatEther } from 'viem';
import { useEffect, useMemo } from 'react';

// WETH Sepolia address
const WETH_ADDRESS = '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9';

// Helper function to format ETH amounts to 6 decimals max
const formatETHAmount = (amount: bigint | undefined): string => {
    if (!amount) return '0';
    const formatted = formatEther(amount);
    const [whole, decimal] = formatted.split('.');
    if (!decimal) return whole;
    return `${whole}.${decimal.slice(0, 6)}`;
};

// Helper function to calculate USD value with 2 decimals
const calculateUSDValue = (ethAmount: bigint, ethPrice: bigint): string => {
    const usdValue = (ethAmount * ethPrice) / BigInt('1000000000000000000');
    const formatted = formatEther(usdValue);
    const [whole, decimal] = formatted.split('.');
    if (!decimal) return whole;
    return `${whole}.${decimal.slice(0, 2)}`;
};

// Helper function to format USD price with 2 decimals
const formatUSDPrice = (amount: bigint): string => {
    const formatted = formatEther(amount);
    const [whole, decimal] = formatted.split('.');
    if (!decimal) return whole;
    return `${whole}.${decimal.slice(0, 2)}`;
};

// ERC20 ABI for the approve and allowance functions
const ERC20_ABI = [
  {
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export function useVault() {
    const { address } = useAccount();

    // Read contract state with refetch functions
    const { data: collateralBalance, isLoading: isLoadingCollateral, refetch: refetchCollateral } = useReadContract({
        ...CONTRACT_CONFIG,
        functionName: 'collateral',
        args: address ? [address] : undefined,
    });

    const { data: mintedBalance, isLoading: isLoadingMinted, refetch: refetchMinted } = useReadContract({
        ...CONTRACT_CONFIG,
        functionName: 'minted',
        args: address ? [address] : undefined,
    });

    // Get liquidation threshold from contract (80%)
    const { data: liquidationThreshold } = useReadContract({
        ...CONTRACT_CONFIG,
        functionName: 'liquidationThreshold',
    });

    // Get maxLTV from contract (66%)
    const { data: maxLTV } = useReadContract({
        ...CONTRACT_CONFIG,
        functionName: 'maxLTV',
    });

    // Get latest ETH price
    const { data: latestPrice, refetch: refetchPrice } = useReadContract({
        ...CONTRACT_CONFIG,
        functionName: 'getLatestPrice',
    });

    // Calculate current ETH price in USD
    const currentETHPrice = useMemo(() => {
        if (!latestPrice) return '0';
        return formatUSDPrice(latestPrice as bigint);
    }, [latestPrice]);

    // Calculate liquidation price
    const liquidationPrice = useMemo(() => {
        console.log('Liquidation price calculation inputs:', {
            collateralBalance,
            mintedBalance,
            liquidationThreshold,
            latestPrice
        });

        if (!collateralBalance || !mintedBalance || !liquidationThreshold || !latestPrice) {
            console.log('Missing required values for liquidation price calculation');
            return '0';
        }

        try {
            const collateralBigInt = BigInt(collateralBalance.toString());
            const mintedBigInt = BigInt(mintedBalance.toString());
            const thresholdBigInt = BigInt(liquidationThreshold.toString());

            console.log('Converted BigInt values:', {
                collateralBigInt: collateralBigInt.toString(),
                mintedBigInt: mintedBigInt.toString(),
                thresholdBigInt: thresholdBigInt.toString()
            });

            // Liquidation occurs when: (eth_price * collateral * threshold) / 100 <= minted_amount
            // Therefore, liquidation_price = (minted_amount * 100) / (collateral * threshold)
            
            // Multiply by 1e18 to maintain precision with decimals
            const numerator = mintedBigInt * BigInt(100) * BigInt('1000000000000000000');
            const denominator = collateralBigInt * thresholdBigInt;
            
            console.log('Calculation components:', {
                numerator: numerator.toString(),
                denominator: denominator.toString()
            });

            if (denominator === BigInt(0)) {
                console.log('Denominator is zero');
                return '0';
            }
            
            const liquidationPriceBigInt = numerator / denominator;
            console.log('Final liquidation price (raw):', liquidationPriceBigInt.toString());

            return formatUSDPrice(liquidationPriceBigInt);
        } catch (error) {
            console.error('Error calculating liquidation price:', error);
            return '0';
        }
    }, [collateralBalance, mintedBalance, liquidationThreshold, latestPrice]);

    // Calculate available to mint
    const availableToMint = useMemo(() => {
        if (!collateralBalance || !liquidationThreshold || !latestPrice || !mintedBalance) {
            return '0';
        }

        try {
            const collateralBalanceBigInt = BigInt(collateralBalance.toString());
            const thresholdBigInt = BigInt(liquidationThreshold.toString());
            const latestPriceBigInt = BigInt(latestPrice.toString());
            const mintedBalanceBigInt = BigInt(mintedBalance.toString());

            // Calculate collateral value in USD (collateral * price / 1e18)
            const collateralValueUSD = (collateralBalanceBigInt * latestPriceBigInt) / BigInt('1000000000000000000');
            
            // Calculate max mintable (collateralValueUSD * threshold / 100)
            const maxMintable = (collateralValueUSD * thresholdBigInt) / BigInt(100);
            
            // Subtract already minted amount
            const available = maxMintable - mintedBalanceBigInt;
            
            // If available is negative or zero, return 0
            return available <= BigInt(0) ? '0' : formatEther(available);
        } catch (error) {
            console.error('Error calculating available to mint:', error);
            return '0';
        }
    }, [collateralBalance, liquidationThreshold, latestPrice, mintedBalance]);

    // Calculate current LTV
    const currentLTV = useMemo(() => {
        if (!collateralBalance || !mintedBalance || !latestPrice) return '0';

        try {
            const collateralBigInt = BigInt(collateralBalance.toString());
            const mintedBigInt = BigInt(mintedBalance.toString());
            const priceBigInt = BigInt(latestPrice.toString());

            // Calculate collateral value in USD
            const collateralValueUSD = (collateralBigInt * priceBigInt) / BigInt('1000000000000000000');
            
            if (collateralValueUSD === BigInt(0)) return '0';

            // Calculate current LTV as percentage
            const ltvRatio = (mintedBigInt * BigInt(100)) / collateralValueUSD;
            
            return ltvRatio.toString();
        } catch (error) {
            console.error('Error calculating current LTV:', error);
            return '0';
        }
    }, [collateralBalance, mintedBalance, latestPrice]);

    // WETH approval
    const { writeContract: approveWETH } = useWriteContract();

    // Write functions with proper configuration
    const { writeContract: depositWrite, isPending: isDepositPending, isSuccess: isDepositSuccess } = useWriteContract();
    const { writeContract: withdrawWrite, isPending: isWithdrawPending, isSuccess: isWithdrawSuccess } = useWriteContract();
    const { writeContract: mintWrite, isPending: isMintPending, isSuccess: isMintSuccess } = useWriteContract();
    const { writeContract: burnWrite, isPending: isBurnPending, isSuccess: isBurnSuccess } = useWriteContract();

    // Check WETH allowance
    const { data: wethAllowance, refetch: refetchAllowance } = useReadContract({
        address: WETH_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: address ? [address, CONTRACT_CONFIG.address] : undefined,
    });

    // Effect to refetch all data after successful transactions
    useEffect(() => {
        const refetchAllData = async () => {
            if (isDepositSuccess || isWithdrawSuccess || isMintSuccess || isBurnSuccess) {
                console.log('Refetching all vault data...');
                await Promise.all([
                    refetchCollateral(),
                    refetchMinted(),
                    refetchPrice(),
                ]).then(([collateral, minted, price]) => {
                    console.log('Refetch results:', {
                        collateral: collateral.data,
                        minted: minted.data,
                        price: price.data
                    });
                });
            }
        };

        refetchAllData();
    }, [isDepositSuccess, isWithdrawSuccess, isMintSuccess, isBurnSuccess]);

    const handleDeposit = async (amount: string) => {
        if (!address) throw new Error('Wallet not connected');
        
        try {
            const parsedAmount = parseEther(amount);
            
            // Check if we need to approve WETH first
            if (wethAllowance !== undefined && wethAllowance < parsedAmount) {
                await approveWETH({
                    address: WETH_ADDRESS,
                    abi: ERC20_ABI,
                    functionName: 'approve',
                    args: [CONTRACT_CONFIG.address, parsedAmount],
                });
                // Refetch allowance after approval
                await refetchAllowance();
            }

            // Now deposit
            await depositWrite({
                ...CONTRACT_CONFIG,
                functionName: 'deposit',
                args: [parsedAmount],
            });
            
            // Refetch balances immediately after deposit
            await Promise.all([
                refetchCollateral(),
                refetchAllowance()
            ]);
        } catch (error) {
            console.error('Error depositing:', error);
            throw error;
        }
    };

    const handleWithdraw = async (amount: string) => {
        if (!address) throw new Error('Wallet not connected');
        
        try {
            await withdrawWrite({
                ...CONTRACT_CONFIG,
                functionName: 'withdraw',
                args: [parseEther(amount)],
            });
            // Refetch balance after withdrawal
            await refetchCollateral();
        } catch (error) {
            console.error('Error withdrawing:', error);
            throw error;
        }
    };

    const handleMint = async (amount: string) => {
        if (!address) throw new Error('Wallet not connected');
        
        try {
            await mintWrite({
                ...CONTRACT_CONFIG,
                functionName: 'mintStablecoin',
                args: [parseEther(amount)],
            });
            // Refetch balance after minting
            await refetchMinted();
        } catch (error) {
            console.error('Error minting:', error);
            throw error;
        }
    };

    const handleBurn = async (amount: string) => {
        if (!address) throw new Error('Wallet not connected');
        
        try {
            await burnWrite({
                ...CONTRACT_CONFIG,
                functionName: 'burnStablecoin',
                args: [parseEther(amount)],
            });
            // Refetch balance after burning
            await refetchMinted();
        } catch (error) {
            console.error('Error burning:', error);
            throw error;
        }
    };

    return {
        // Balances with formatted values
        collateralBalance: collateralBalance ? formatETHAmount(collateralBalance as bigint) : '0',
        collateralUSDValue: collateralBalance && latestPrice ? 
            calculateUSDValue(collateralBalance as bigint, latestPrice as bigint) : '0',
        mintedBalance: mintedBalance ? formatETHAmount(mintedBalance as bigint) : '0',
        availableToMint: availableToMint ? formatETHAmount(BigInt(parseEther(availableToMint))) : '0',
        currentETHPrice,
        liquidationPrice,

        // Loading states for balances
        isLoadingCollateral,
        isLoadingMinted,

        // Actions
        deposit: handleDeposit,
        withdraw: handleWithdraw,
        mint: handleMint,
        burn: handleBurn,

        // Transaction states
        isDepositLoading: isDepositPending,
        isWithdrawLoading: isWithdrawPending,
        isMintLoading: isMintPending,
        isBurnLoading: isBurnPending,

        // Success states
        isDepositSuccess,
        isWithdrawSuccess,
        isMintSuccess,
        isBurnSuccess,

        // New LTV calculations
        currentLTV,
        maxLTV: maxLTV ? maxLTV.toString() : '0',
        liquidationThreshold: liquidationThreshold ? liquidationThreshold.toString() : '0',
    };
} 