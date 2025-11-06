"use client";

interface MintSuccessModalProps {
  assetId: string;
  onClose: () => void;
}

export default function MintSuccessModal({
  assetId,
  onClose,
}: MintSuccessModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            ✅ Mint Successful!
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Asset ID:</p>
            <p className="text-xs font-mono text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-900 p-2 rounded break-all">
              {assetId}
            </p>
          </div>

          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ℹ️ Your NFT gallery will refresh automatically in a few seconds. If the NFT doesn't appear immediately, it may still be indexing. You can manually refresh using the refresh button.
            </p>
          </div>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              <strong>⚠️ Wallet Warning:</strong> Your wallet may show this NFT as "Unverified" - this is expected for test NFTs. The collection isn't verified, but the NFT is fully functional and safe to use.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <a
              href={`https://explorer.solana.com/address/${assetId}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              🔍 View on Solana Explorer →
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

