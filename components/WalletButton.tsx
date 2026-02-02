'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import bs58 from 'bs58';

interface WalletButtonProps {
  onAuthenticated?: (wallet: string, signature: string, message: string) => void;
  className?: string;
}

export const WalletButton: FC<WalletButtonProps> = ({ onAuthenticated, className }) => {
  const { publicKey, connected, disconnect, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
    setAuthError(null);
  }, [disconnect]);

  // Authenticate after connection
  const authenticate = useCallback(async () => {
    if (!publicKey || !signMessage) return;
    
    setIsAuthenticating(true);
    setAuthError(null);
    
    try {
      const nonce = Math.random().toString(36).substring(2, 15);
      const timestamp = Date.now();
      const message = `Sign this message to authenticate with OSINT.market\nNonce: ${nonce}\nTimestamp: ${timestamp}`;
      
      const encodedMessage = new TextEncoder().encode(message);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);
      
      if (onAuthenticated) {
        onAuthenticated(publicKey.toBase58(), signatureBase58, message);
      }
      
      // Store auth in session storage
      sessionStorage.setItem('osint_wallet', publicKey.toBase58());
      sessionStorage.setItem('osint_sig', signatureBase58);
      sessionStorage.setItem('osint_msg', message);
      
    } catch (error: any) {
      console.error('Authentication error:', error);
      setAuthError(error.message || 'Failed to authenticate');
    } finally {
      setIsAuthenticating(false);
    }
  }, [publicKey, signMessage, onAuthenticated]);

  // Show auth button after connect
  const [needsAuth, setNeedsAuth] = useState(false);
  
  useEffect(() => {
    if (connected && publicKey) {
      const storedWallet = sessionStorage.getItem('osint_wallet');
      if (storedWallet !== publicKey.toBase58()) {
        setNeedsAuth(true);
      }
    } else {
      setNeedsAuth(false);
    }
  }, [connected, publicKey]);

  const baseClass = "px-4 py-2 rounded font-bold transition-all";
  const buttonClass = className || baseClass;

  if (!connected) {
    return (
      <button
        onClick={handleConnect}
        className={`${buttonClass} bg-purple-600 hover:bg-purple-500 text-white`}
      >
        Connect Wallet
      </button>
    );
  }

  if (needsAuth) {
    return (
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={authenticate}
          disabled={isAuthenticating}
          className={`${buttonClass} bg-green-600 hover:bg-green-500 text-white disabled:opacity-50`}
        >
          {isAuthenticating ? 'Signing...' : 'Sign to Authenticate'}
        </button>
        {authError && (
          <span className="text-red-400 text-sm">{authError}</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-green-400 text-sm font-mono">
        {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
      </span>
      <button
        onClick={handleDisconnect}
        className={`${buttonClass} bg-gray-700 hover:bg-gray-600 text-white text-sm`}
      >
        Disconnect
      </button>
    </div>
  );
};

export default WalletButton;
