"use client";

import {
  FiHome,
  FiStar,
  FiFolder,
  FiChevronRight,
  FiPlus,
} from "react-icons/fi";
import clsx from "clsx";

interface SidebarProps {
  expanded: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
}

export default function Sidebar({
  expanded,
  onMouseEnter,
  onMouseLeave
}: SidebarProps) {
  return (
    <aside
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        "fixed left-0 top-[64px] h-[calc(100vh-64px)] bg-white border-r transition-all duration-200 z-30 flex flex-col",
        expanded ? "w-60" : "w-16"
      )}
    >
      <div className="mt-[64px]"> 
        <SidebarItem icon={<FiHome />} label="Home" expanded={expanded} active />
        <SidebarItem icon={<FiStar />} label="Starred" expanded={expanded} />
        <SidebarItem icon={<FiFolder />} label="Shared" expanded={expanded} />
        <SidebarItem
          icon={<FiChevronRight />}
          label="Workspaces"
          expanded={expanded}
          rightIcon={<FiPlus />}
        />
      </div>

      <div className="mt-auto mb-4">
        <SidebarItem icon={<FiFolder />} label="Templates and apps" expanded={expanded} />
        <SidebarItem icon={<FiStar />} label="Marketplace" expanded={expanded} />
        <SidebarItem icon={<FiPlus />} label="Import" expanded={expanded} />
      </div>

      <button
        className={clsx(
          "mx-3 py-2 bg-[#216CFF] text-white rounded-md font-medium text-sm flex items-center justify-center",
          expanded ? "px-4" : "px-0"
        )}
      >
        + {expanded && "Create"}
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
        "flex items-center gap-3 mx-2 px-2 py-[9px] rounded-md cursor-pointer text-gray-700 hover:bg-gray-100 transition-colors",
        active && "bg-gray-100 font-medium text-black"
      )}
    >
      <div className="text-xl">{icon}</div>

      {expanded && <span className="text-sm flex-1">{label}</span>}

      {expanded && rightIcon}
    </div>
  );
}
