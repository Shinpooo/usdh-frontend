import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
    appName: 'Suq',
    projectId: 'c4a5352f4f7e1e5a3c3fef561a986fd9', // Public demo project ID from RainbowKit
    chains: [sepolia],
});