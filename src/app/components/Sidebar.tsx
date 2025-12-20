"use client";

import {
  FiStar,
  FiPlus,
  FiBookOpen,
  FiShoppingBag,
  FiGlobe,
  FiChevronDown,
  FiChevronRight,
} from "react-icons/fi";
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

function WorkspacesIcon() {
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
        d="M3.68726 2.76918C3.00369 2.77619 2.31788 3.05605 1.8208 3.65761C0.919321 4.74857 1.17576 6.24775 2.08557 7.09572C1.40673 7.38504 0.802933 7.84404 0.349488 8.4507C0.310181 8.50329 0.281619 8.56312 0.265432 8.62675C0.249245 8.69038 0.24575 8.75658 0.255147 8.82157C0.264544 8.88656 0.286648 8.94905 0.320199 9.00549C0.353749 9.06194 0.398088 9.11122 0.450684 9.15053C0.503281 9.18983 0.563104 9.21839 0.626738 9.23458C0.690373 9.25077 0.756572 9.25426 0.821558 9.24487C0.886543 9.23547 0.949041 9.21337 1.00548 9.17981C1.06193 9.14626 1.11121 9.10193 1.15051 9.04933C1.76315 8.2297 2.72586 7.74834 3.74915 7.75001C3.74907 7.75005 3.74923 7.74997 3.74915 7.75001C3.74953 7.75001 3.75011 7.75001 3.75049 7.75001C3.87664 7.74769 3.99725 7.69777 4.08814 7.61024C4.09539 7.60337 4.10243 7.59629 4.10925 7.589C4.19691 7.49831 4.24706 7.37783 4.24963 7.25172C4.24951 7.252 4.24976 7.25144 4.24963 7.25172C4.24959 7.25147 4.24992 7.25038 4.24988 7.25013C4.24984 7.25034 4.24992 7.24993 4.24988 7.25013C4.24976 7.24984 4.24976 7.24894 4.24963 7.24865C4.24718 7.12237 4.19703 7.0017 4.10925 6.91088C4.10254 6.90377 4.09562 6.89685 4.0885 6.89013C3.99767 6.80248 3.87706 6.75243 3.75086 6.75001C3.75044 6.75001 3.75005 6.75014 3.74963 6.75014C3.74967 6.75018 3.74959 6.7501 3.74963 6.75014C2.44509 6.75147 1.76078 5.30012 2.59168 4.29457C3.42258 3.28902 4.97671 3.68735 5.22131 4.96876C5.23363 5.03326 5.25853 5.09471 5.29459 5.14958C5.33066 5.20446 5.37718 5.25169 5.4315 5.28859C5.48582 5.32549 5.54687 5.35132 5.61118 5.36462C5.67548 5.37792 5.74178 5.37843 5.80628 5.3661C5.93651 5.34123 6.05154 5.26564 6.12605 5.15596C6.20057 5.04629 6.22847 4.91151 6.20361 4.78126C5.95974 3.50367 4.82653 2.7575 3.68726 2.76918Z M12.3127 2.76918C11.1735 2.7575 10.0403 3.50367 9.79639 4.78126C9.77154 4.91151 9.79943 5.04629 9.87395 5.15596C9.94846 5.26564 10.0635 5.34123 10.1937 5.3661C10.2582 5.37843 10.3245 5.37792 10.3888 5.36462C10.4531 5.35132 10.5142 5.32549 10.5685 5.28859C10.6228 5.25169 10.6693 5.20446 10.7054 5.14958C10.7415 5.09471 10.7664 5.03326 10.7787 4.96876C11.0233 3.68735 12.5774 3.28902 13.4083 4.29457C14.2392 5.30012 13.555 6.75134 12.2505 6.75001C12.2505 6.74997 12.2504 6.75005 12.2505 6.75001C12.25 6.75001 12.2496 6.75001 12.2491 6.75001C12.1871 6.76292 12.1282 6.78748 12.0753 6.8224C12.0115 6.83534 11.9508 6.86064 11.8966 6.89686C11.8603 6.95112 11.835 7.01196 11.8221 7.07594C11.7873 7.12872 11.7629 7.18762 11.75 7.24952C11.75 7.24931 11.7501 7.24973 11.75 7.24952C11.75 7.24976 11.7501 7.25064 11.75 7.25088C11.7629 7.31289 11.7875 7.37187 11.8224 7.42471C11.8353 7.48856 11.8606 7.54927 11.8969 7.60342C11.9511 7.63969 12.0119 7.66499 12.0759 7.67788C12.1287 7.71269 12.1876 7.73717 12.2495 7.75003C12.2499 7.75003 12.2502 7.7499 12.2506 7.7499C12.2505 7.74986 12.2507 7.74994 12.2506 7.7499C13.2738 7.7481 14.237 8.22964 14.8495 9.04934C14.8888 9.10194 14.9381 9.14628 14.9945 9.17983C15.051 9.21338 15.1135 9.23548 15.1785 9.24488C15.2434 9.25428 15.3096 9.25078 15.3733 9.2346C15.4369 9.21841 15.4967 9.18985 15.5493 9.15054C15.6019 9.11123 15.6463 9.06195 15.6798 9.00551C15.7134 8.94907 15.7355 8.88657 15.7449 8.82158C15.7543 8.7566 15.7508 8.6904 15.7346 8.62676C15.7184 8.56313 15.6898 8.50331 15.6505 8.45071C15.1971 7.844 14.5934 7.38493 13.9146 7.09561C14.8243 6.24762 15.0806 4.74853 14.1792 3.65762C13.6821 3.05606 12.9962 2.77619 12.3127 2.76918Z M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z"
      />
    </svg>
  );
}

interface SidebarProps {
  expanded: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onCreateBase: () => void;
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
        "fixed left-0 top-[56px] h-[calc(100vh-56px)] bg-white border-r border-[#e6e8eb] transform transition-all duration-300 ease-in-out z-30 flex flex-col",
        expanded ? "w-75" : "w-12"
      )}
    >
      <div className="mt-3 flex flex-col gap-0 text-black px-2">
        <SidebarItem
          icon={<AirtableHomeIcon />}
          label="Home"
          expanded={expanded}
          active
        />
        <SidebarItem
          icon={<FiStar />}
          label="Starred"
          expanded={expanded}
          rightIcon={<FiChevronDown className="text-[#6b7280]" />}
        />
        {expanded && <StarredEmptyHint />}
        <SidebarItem
          icon={<ShareArrowIcon className="h-5 w-5 text-gray-600" />}
          label="Shared"
          expanded={expanded}
        />
        <SidebarItem
          icon={<WorkspacesIcon />}
          label="Workspaces"
          expanded={expanded}
          rightIcon={
            <div className="flex items-center gap-3 text-[#6b7280]">
              <FiPlus />
              <FiChevronRight />
            </div>
          }
        />
      </div>

      <div
        className={clsx(
          "mt-auto mb-3 text-gray-300 w-full",
          expanded ? "px-3" : "px-0 flex flex-col items-center"
        )}
      >
        <div
          className={clsx(
            "border-t border-[#e6e8eb] mb-3",
            !expanded && "w-6"
          )}
        />
        <SidebarItem icon={<FiBookOpen />} label="Templates and apps" expanded={expanded} compact />
        <SidebarItem icon={<FiShoppingBag />} label="Marketplace" expanded={expanded} compact />
        <SidebarItem icon={<FiGlobe />} label="Import" expanded={expanded} compact />
      </div>

      <button
        onClick={onCreateBase}
        className={clsx(
          "mb-3 rounded-md font-semibold text-[13px] flex items-center justify-center transition-colors",
          expanded
            ? "px-4 py-2.5 bg-[#216CFF] text-white border border-[#216CFF] hover:bg-[#1b59d4] mx-3"
            : "h-9 w-9 bg-white text-[#6b7280] border border-[#e6e8eb] hover:bg-[#f2f4f7] text-base mx-auto"
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
  compact?: boolean;
};

function SidebarItem({
  icon,
  label,
  expanded,
  active = false,
  rightIcon,
  compact = false,
}: SidebarItemProps) {
  const baseCollapsed = compact
    ? "mx-auto my-2 h-8 w-8 justify-center"
    : "mx-auto my-2 h-8 w-8 justify-center";
  const baseExpanded = compact
    ? "gap-3 mx-1 px-2.5 py-1.5 text-left"
    : "gap-3 mx-1 px-3 py-2 text-left";
  return (
    <div
      className={clsx(
        "flex items-center rounded-md cursor-pointer text-[#4b5563] hover:bg-[#f2f4f7] transition-colors select-none",
        expanded ? baseExpanded : baseCollapsed,
        active &&
          (expanded
            ? "bg-[#f0f2f7] text-[#1f2933] font-semibold"
            : "text-[#1f2933]")
      )}
    >
      <div
        className={clsx(
          compact ? "text-[15px]" : "text-base",
          "text-[#4a5568]",
          expanded ? "" : "flex items-center justify-center"
        )}
      >
        {icon}
      </div>

      {expanded && (
        <span className={clsx("flex-1 font-medium", compact ? "text-[12px]" : "text-[14px]")}>
          {label}
        </span>
      )}

      {expanded && rightIcon}
    </div>
  );
}

function StarredEmptyHint() {
  return (
    <div className="flex items-start gap-3 pl-5 pr-3 pb-3 text-[12px] text-[#6b7280]">
      <span className="mt-[2px] h-6 w-6 rounded-md border border-[#e6e8eb] flex items-center justify-center text-[#9ca3af]">
        <FiStar size={14} />
      </span>
      <div className="leading-tight">
        <div>Your starred bases, interfaces, and</div>
        <div>workspaces will appear here</div>
      </div>
    </div>
  );
}
