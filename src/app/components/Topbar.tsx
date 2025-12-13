import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { FiHelpCircle, FiMenu } from "react-icons/fi";
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
    <header className="fixed top-0 left-0 right-0 h-[64px] border-b bg-white flex items-center px-4 justify-between z-40">
      {/* left: menu + logo */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-md hover:bg-gray-100 transition"
        >
          <FiMenu size={22} className="text-gray-700" />
        </button>

        <Image
          src="/airtable-logo.png"
          alt="Airtable"
          width={34}
          height={34}
          priority
        />
      </div>

      {/* center search */}
      <div className="flex-1 flex justify-center">
        <div className="w-[380px]">
          <input
            className="w-full h-10 px-4 rounded-full border border-gray-300 text-sm focus:outline-none"
            placeholder="Search...      ctrl + K"
          />
        </div>
      </div>

      {/* right */}
      <div className="flex items-center gap-6">
        <FiHelpCircle className="text-[21px] text-gray-600" />
        <div className="relative" ref={menuRef}>
          <button
            ref={buttonRef}
            onClick={() => setMenuOpen((p) => !p)}
            className="flex items-center justify-center h-10 w-10 rounded-full border border-gray-200 bg-white hover:shadow-sm transition"
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
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl text-sm text-gray-800 overflow-hidden">
              <div className="px-4 py-3 border-b">
                <div className="font-semibold text-gray-900">{user?.name ?? "Account"}</div>
                <div className="text-[12px] text-gray-500 truncate">{user?.email ?? "Signed in"}</div>
              </div>
              <div className="flex flex-col">
                <button
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                  onClick={() => setMenuOpen(false)}
                >
                  <FiUser className="text-gray-600" />
                  <span>Account</span>
                </button>
                <button
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left"
                  onClick={() => setMenuOpen(false)}
                >
                  <FiSettings className="text-gray-600" />
                  <span>Settings</span>
                </button>
                <div className="border-t my-1" />
                <button
                  className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 text-left text-red-600"
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
