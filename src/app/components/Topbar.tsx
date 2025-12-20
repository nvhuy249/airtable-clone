import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiMenu,
  FiSearch,
  FiUser,
  FiUsers,
  FiGlobe,
  FiSun,
  FiChevronRight,
  FiMail,
  FiArrowUpCircle,
  FiSend,
  FiZap,
  FiBox,
  FiTrash2,
} from "react-icons/fi";
import { FiLogOut } from "react-icons/fi";
import { signOut } from "next-auth/react";
import type { Session } from "next-auth";

type TopbarProps = {
  user: Session["user"] | null;
  onToggleSidebar: () => void;
};

export default function Topbar({ user, onToggleSidebar }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const closeMenu = () => setMenuOpen(false);

  const MenuRow = ({
    icon,
    label,
    right,
    onClick,
    danger,
  }: {
    icon: React.ReactNode;
    label: string;
    right?: React.ReactNode;
    onClick?: () => void;
    danger?: boolean;
  }) => (
    <button
      type="button"
      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-[13px] hover:bg-[#f4f6fb] ${
        danger ? "text-red-600" : "text-[#1f2933]"
      }`}
      onClick={() => {
        onClick?.();
      }}
    >
      <span className="text-[#4b5563] text-[15px]">{icon}</span>
      <span className="flex-1">{label}</span>
      {right}
    </button>
  );

  return (
    <header className="fixed top-0 left-0 right-0 h-[56px] border-b border-[#e6e8eb] bg-white shadow-sm flex items-center px-2 justify-between z-40">
      {/* left: menu + logo */}
      <div className="flex items-center gap-1">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-[#f2f4f7] transition border border-transparent hover:border-[#e6e8eb]"
        >
          <FiMenu size={22} className="text-gray-400" />
        </button>

        <Image
          src="/airtable-logo.png"
          alt="Airtable"
          width={34}
          height={34}
          priority
        />
        <span className="text-lg font-bold">Airtable</span>
      </div>

      {/* center search */}
      <div className="flex-1 flex justify-center">
        <div className="w-[380px] relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9ca3af]" size={16} />
          <input
            className="w-full h-9 pl-9 pr-4 rounded-full border border-[#e6e8eb] text-[13px] text-[#1f2933] placeholder:text-[#9ca3af] focus:outline-none bg-white shadow-sm"
            placeholder="Search...      ctrl + K"
          />
        </div>
      </div>

      {/* right */}
      <div className="flex items-center gap-6">
        <FiBell className="text-[20px] text-[#6b7280]" />
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center justify-center h-7 w-7 rounded-full border border-[#e6e8eb] bg-white hover:shadow-sm transition"
            aria-label="User menu"
          >
            {user?.image ? (
              <Image
                src={user.image}
                alt="avatar"
                width={24}
                height={24}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-700">{userInitial}</span>
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-[280px] rounded-2xl border border-[#e6e8eb] bg-white shadow-xl text-sm text-[#1f2933] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e6e8eb]">
                <div className="font-semibold text-[#1f2933] text-[14px]">
                  {user?.name ?? "Account"}
                </div>
                <div className="text-[12px] text-[#6b7280] truncate">
                  {user?.email ?? "Signed in"}
                </div>
              </div>

              <div className="border-b border-[#e6e8eb]">
                <MenuRow icon={<FiUser />} label="Account" onClick={closeMenu} />
                <MenuRow
                  icon={<FiUsers />}
                  label="Manage groups"
                  right={
                    <span className="px-2 py-0.5 rounded-full bg-[#e8f2fd] text-[#1d6fdc] text-[12px]">
                      Business
                    </span>
                  }
                  onClick={closeMenu}
                />
                <MenuRow
                  icon={<FiBell />}
                  label="Notification preferences"
                  right={<FiChevronRight className="text-[#9ca3af]" />}
                  onClick={closeMenu}
                />
                <MenuRow
                  icon={<FiGlobe />}
                  label="Language preferences"
                  right={<FiChevronRight className="text-[#9ca3af]" />}
                  onClick={closeMenu}
                />
                <MenuRow
                  icon={<FiSun />}
                  label="Appearance"
                  right={
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-[#fef3d8] text-[#b7791f] text-[11px]">
                        Beta
                      </span>
                      <FiChevronRight className="text-[#9ca3af]" />
                    </div>
                  }
                  onClick={closeMenu}
                />
              </div>

              <div className="border-b border-[#e6e8eb]">
                <MenuRow icon={<FiMail />} label="Contact sales" onClick={closeMenu} />
                <MenuRow icon={<FiArrowUpCircle />} label="Upgrade" onClick={closeMenu} />
                <MenuRow icon={<FiSend />} label="Tell a friend" onClick={closeMenu} />
              </div>

              <div className="border-b border-[#e6e8eb]">
                <MenuRow icon={<FiZap />} label="Integrations" onClick={closeMenu} />
                <MenuRow icon={<FiBox />} label="Builder hub" onClick={closeMenu} />
              </div>

              <div>
                <MenuRow icon={<FiTrash2 />} label="Trash" onClick={closeMenu} />
                <MenuRow
                  icon={<FiLogOut />}
                  label="Log out"
                  danger
                  onClick={() => {
                    closeMenu();
                    void signOut();
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
