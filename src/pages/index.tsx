import type { NextPage } from 'next';
import Head from 'next/head';
import VaultDashboard from '../components/VaultDashboard';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>USDH Vault</title>
        <meta
          content="USDH Vault - Decentralized Stablecoin Protocol"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <VaultDashboard />
    </>
  );
};

export default Home;
