import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NetworkProvider } from "@/contexts/NetworkContext";
import { WalletProvider } from "@/components/WalletProvider";

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
          <WalletProvider>{children}</WalletProvider>
        </NetworkProvider>
      </body>
    </html>
  );
}
