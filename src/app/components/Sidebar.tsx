"use client";

import { FiStar, FiPlus, FiBookOpen, FiShoppingBag, FiGlobe, FiUsers } from "react-icons/fi";
import { ShareArrowIcon } from "./icons/ShareArrowIcon";
import clsx from "clsx";

function AirtableHomeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      shapeRendering="geometricPrecision"
    >
      <path
        fillRule="nonzero"
        d="M8 1.67725C7.75721 1.67725 7.51436 1.76397 7.32495 1.93726L2.32617 6.47986C2.32379 6.48203 2.32143 6.48423 2.31909 6.48645C2.11974 6.67482 2.00463 6.93622 2.00012 7.21045C2.00006 7.21318 2.00002 7.2159 2 7.21863V12.9999C2.00007 13.5462 2.45357 13.9998 2.99988 13.9999C2.99984 13.9999 2.99992 13.9999 2.99988 13.9999H6C6.54636 13.9999 7 13.5462 7 12.9999V9.99988H9V12.9999C9 13.5462 9.45364 13.9999 10 13.9999H13C13.5464 13.9999 14 13.5462 14 12.9999V7.21863C14 7.21594 13.9999 7.21326 13.9999 7.21057C13.9954 6.93627 13.8802 6.67471 13.6808 6.48633C13.6785 6.48415 13.6762 6.48199 13.6738 6.47986L8.67505 1.93726C8.48564 1.76397 8.24279 1.67725 8 1.67725ZM8 2.67505C8.00041 2.67542 8.00081 2.67578 8.00122 2.67615L12.9941 7.21338C12.9979 7.21694 12.9998 7.22129 13 7.22644V12.9999H10V9.99988C10 9.45352 9.54636 8.99988 9 8.99988H7C6.45363 8.99988 6 9.45352 6 9.99988V12.9999H3.00012L3 7.22656C3.00015 7.22145 3.00206 7.21707 3.00573 7.2135L7.99878 2.67615C7.99919 2.67578 7.99959 2.67542 8 2.67505Z"
      />
    </svg>
  );
}

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
        <SidebarItem icon={<AirtableHomeIcon />} label="Home" expanded={expanded} />
        <SidebarItem icon={<FiStar />} label="Starred" expanded={expanded} />
        <SidebarItem icon={<ShareArrowIcon className="h-5 w-5 text-gray-500" />} label="Shared" expanded={expanded} />
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
