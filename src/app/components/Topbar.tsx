import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FiHelpCircle, FiMenu, FiSearch } from "react-icons/fi";
import { FiUser, FiSettings, FiLogOut } from "react-icons/fi";
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

  return (
    <header className="fixed top-0 left-0 right-0 h-[64px] border-b border-[#e6e8eb] bg-white flex items-center px-4 justify-between z-40">
      {/* left: menu + logo */}
      <div className="flex items-center gap-3">
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
        <span className="text-lg font-semibold">Airtable</span>
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
        <FiHelpCircle className="text-[20px] text-[#6b7280]" />
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center justify-center h-10 w-10 rounded-full border border-[#e6e8eb] bg-white hover:shadow-sm transition"
            aria-label="User menu"
          >
            {user?.image ? (
              <Image
                src={user.image}
                alt="avatar"
                width={36}
                height={36}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-700">{userInitial}</span>
            )}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-[#e6e8eb] bg-white shadow-xl text-sm text-[#1f2933] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e6e8eb]">
                <div className="font-semibold text-[#1f2933]">{user?.name ?? "Account"}</div>
                <div className="text-[12px] text-[#6b7280] truncate">{user?.email ?? "Signed in"}</div>
              </div>
              <div className="flex flex-col">
                <button
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[#f2f4f7] text-left"
                  onClick={() => setMenuOpen(false)}
                >
                  <FiUser className="text-[#6b7280]" />
                  <span>Account</span>
                </button>
                <button
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[#f2f4f7] text-left"
                  onClick={() => setMenuOpen(false)}
                >
                  <FiSettings className="text-[#6b7280]" />
                  <span>Settings</span>
                </button>
                <div className="border-t border-[#e6e8eb] my-1" />
                <button
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[#f2f4f7] text-left text-red-600"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                >
                  <FiLogOut className="text-red-600" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
