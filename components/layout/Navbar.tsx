"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import Image from "next/image";

export default function Navbar() {
  const pathname = usePathname();

  const NavLink = ({ href, label }: { href: string; label: string }) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${active
            ? "bg-white/20 text-white"
            : "text-white/80 hover:text-white hover:bg-white/10"
          }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="glass border rounded-2xl mx-auto max-w-7xl mt-4 mb-6 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
        <Image
            src="/icon.jpeg"
            alt="Logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-xl"
          />
        </div>

        <span className="text-white font-semibold tracking-wide hidden sm:block">PolyArbX</span>
      </div>
      <div className="flex items-center gap-2">
        <NavLink href="/" label="Dashboard" />
        <NavLink href="/settings" label="Settings" />
      </div>
    </nav>
  );
}
