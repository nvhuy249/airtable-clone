import Image from "next/image";
import { FiHelpCircle, FiMenu } from "react-icons/fi";
import type { Session } from "next-auth";

type TopbarProps = {
  user: Session["user"] | null;
  onToggleSidebar: () => void;
};

export default function Topbar({ user, onToggleSidebar }: TopbarProps) {
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
        <Image
          src={user?.image ?? "/avatar.png"}
          alt="avatar"
          width={34}
          height={34}
          className="rounded-full"
        />
      </div>
    </header>
  );
}
