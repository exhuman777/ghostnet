import { createPublicClient, createWalletClient, http } from '@arkiv-network/sdk';
import { mendoza } from '@arkiv-network/sdk/chains';
import { privateKeyToAccount, generatePrivateKey } from '@arkiv-network/sdk/accounts';

export function getPublicClient() {
  return createPublicClient({ chain: mendoza, transport: http() });
}

export function getWalletClient(key: `0x${string}`) {
  return createWalletClient({
    chain: mendoza,
    transport: http(),
    account: privateKeyToAccount(key),
  });
}

export function generateWallet() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  return { privateKey, address: account.address };
}
