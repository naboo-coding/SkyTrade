"use client";

import Navbar from "@/components/Navbar";
import VaultExplorer from "@/components/VaultExplorer";
import { useState, useEffect } from "react";
import ScrollButton from "@/components/ScrollButton";

export default function EscrowPage() {
  const [mounted, setMounted] = useState(false);
  const [escrowPanelOpen, setEscrowPanelOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <Navbar />
      <main className="relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <VaultExplorer onEscrowPanelChange={setEscrowPanelOpen} />
        </div>
      </main>
      <ScrollButton hide={escrowPanelOpen} />
    </div>
  );
}

