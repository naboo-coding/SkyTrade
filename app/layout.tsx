import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { WalletProvider } from "@/components/WalletProvider";
import { UmiProvider } from "@/components/UmiProvider";
import { ToastProvider } from "@/components/ToastContainer";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SkyTrade - cNFT Fractionalization",
  description: "Fractionalize your compressed NFTs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <NetworkProvider>
          <WalletProvider>
            <UmiProvider>
              <ToastProvider>{children}</ToastProvider>
            </UmiProvider>
          </WalletProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
