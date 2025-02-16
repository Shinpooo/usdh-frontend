import type { NextPage } from 'next';
import Head from 'next/head';
import VaultDashboard from '../components/VaultDashboard';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>Suq</title>
        <meta
          content="Suq - Decentralized Interest-Free Stablecoin Protocol"
          name="description"
        />
        <link href="/favicon.ico" rel="icon" />
      </Head>

      <VaultDashboard />
    </>
  );
};

export default Home;
