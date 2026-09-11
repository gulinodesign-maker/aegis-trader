"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChartNoAxesCombined, Radar, Settings2, WalletCards } from "lucide-react";
import { haptic } from "./haptics";

const items = [
  { href: "/", label: "Today", icon: ChartNoAxesCombined },
  { href: "/scanner", label: "Scanner", icon: Radar },
  { href: "/agent", label: "Agent", icon: Bot },
  { href: "/portfolio", label: "Portfolio", icon: WalletCards },
  { href: "/settings", label: "Settings", icon: Settings2 }
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-white/8 bg-[#090c11]/92 backdrop-blur-xl">
      <div className="safe-bottom app-width grid grid-cols-5 px-2 pt-2">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} onClick={() => haptic(7)} className={`touch flex flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold ${active ? "text-white" : "text-slate-500"}`}>
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
