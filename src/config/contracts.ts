import { sepolia } from 'viem/chains';
import { USDH_VAULT_ABI } from './abi';

export const USDH_VAULT_ADDRESS = '0x42da1F8eE0de531944741117B86eE0ec64585f14' as const;

export const CONTRACT_CONFIG = {
    address: USDH_VAULT_ADDRESS,
    abi: USDH_VAULT_ABI,
    chain: sepolia,
} as const; 