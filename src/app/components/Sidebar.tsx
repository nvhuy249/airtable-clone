"use client";

import { FiHome, FiStar, FiPlus, FiShare, FiBookOpen, FiShoppingBag, FiGlobe, FiUsers } from "react-icons/fi";
import clsx from "clsx";

interface SidebarProps {
  expanded: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onCreateBase: () => void
}

export default function Sidebar({
  expanded,
  onMouseEnter,
  onMouseLeave,
  onCreateBase
}: SidebarProps) {
  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        "fixed left-0 top-[64px] h-[calc(100vh-64px)] bg-white border-r border-[#e6e8eb] transition-all duration-200 z-30 flex flex-col",
        expanded ? "w-60" : "w-14"
      )}
    >
      <div className="mt-4 flex flex-col gap-0 text-black">
        <SidebarItem icon={<FiHome />} label="Home" expanded={expanded} />
        <SidebarItem icon={<FiStar />} label="Starred" expanded={expanded} />
        <SidebarItem icon={<FiShare />} label="Shared" expanded={expanded} />
        <SidebarItem
          icon={<FiUsers />}
          label="Workspaces"
          expanded={expanded}
          rightIcon={<FiPlus />}
        />
      </div>

      <div className="mt-auto mb-4 text-gray-300">
        <SidebarItem icon={<FiBookOpen />} label="Templates and apps" expanded={expanded} />
        <SidebarItem icon={<FiShoppingBag />} label="Marketplace" expanded={expanded} />
        <SidebarItem icon={<FiGlobe />} label="Import" expanded={expanded} />
      </div>

      <button
      onClick={onCreateBase}
        className={clsx(
          "mx-2 py-2 rounded-sm font-medium text-sm flex items-center justify-center transition-colors",
          expanded
            ? "px-4 bg-[#216CFF] text-white border border-[#216CFF] hover:bg-[#1b59d4]"
            : "px-0 bg-white text-gray-500 border border-[#e6e8eb] hover:bg-[#f2f4f7]"
        )}
      >
        + {expanded && "Create base"}
      </button>
    </aside>
  );
}

type SidebarItemProps = {
  icon: React.ReactNode;
  label: string;
  expanded: boolean;
  active?: boolean;
  rightIcon?: React.ReactNode;
};

function SidebarItem({
  icon,
  label,
  expanded,
  active = false,
  rightIcon,
}: SidebarItemProps) {
  return (
    <div
      className={clsx(
        "flex items-center rounded-md cursor-pointer text-[#4b5563] hover:bg-[#f2f4f7] transition-colors select-none",
        expanded
          ? "gap-3 mx-2 px-2.5 py-2 text-left"
          : "mx-auto my-[6px] h-10 w-10 justify-center",
        active && "bg-[#eef2f7] text-[#1f2933]"
      )}
    >
      <div className={clsx("text-lg text-[#6b7280]", expanded ? "" : "flex items-center justify-center")}>
        {icon}
      </div>

      {expanded && <span className="text-[13px] flex-1">{label}</span>}

      {expanded && rightIcon}
    </div>
  );
}
