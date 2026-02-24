import { useConnect, useDisconnect, useConnection } from "wagmi";

export function WalletButton() {
  const { address, status } = useConnection();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const isConnected = status === "connected";
  const isConnecting = status === "connecting" || status === "reconnecting";
  const injectedConnector = connectors[0];

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
        <button
          onClick={() => disconnect()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-300 hover:bg-stone-400 dark:bg-gray-700 dark:hover:bg-gray-600 text-stone-700 dark:text-gray-200 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
      disabled={isConnecting || !injectedConnector}
      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors"
    >
      {isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
