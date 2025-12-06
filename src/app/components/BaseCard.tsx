"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  FiStar,
  FiMoreHorizontal,
  FiEdit2,
  FiCopy,
  FiArrowRight,
  FiUsers,
  FiImage,
  FiTrash2,
} from "react-icons/fi";
import { TbDatabase } from "react-icons/tb";

export interface Base {
  id: string;
  name: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  ownerId: string;
}

interface BaseCardProps {
  base: Base;
  onDelete?: (id: string) => void;
}

function formatRelativeTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Created just now";

  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Created just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Created ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Created ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Created ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Created ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `Created ${years} year${years === 1 ? "" : "s"} ago`;
}

export default function BaseCard({ base, onDelete }: BaseCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [starred, setStarred] = useState(false);

  const initials = useMemo(() => {
    const trimmed = base.name?.trim();
    if (!trimmed) return "Un";
    return trimmed.slice(0, 2).padEnd(2, " ").toUpperCase();
  }, [base.name]);

  const toggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setStarred((prev) => !prev);
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMenuOpen((prev) => !prev);
  };

  const closeMenu = () => setMenuOpen(false);
  const createdLabel = formatRelativeTime(base.createdAt);

  return (
    <div
      className={`relative border rounded-xl bg-white transition shadow-sm w-full ${
        hovered || menuOpen ? "shadow-md border-gray-300" : "border-gray-200"
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
    >
      <div className="flex items-start gap-3 p-4">
        <div className="h-10 w-10 rounded-lg bg-[#4c5566] text-white flex items-center justify-center text-base font-semibold">
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <Link
                href={`/base/${base.id}`}
                className="text-sm font-semibold text-[#0f2cbf] hover:underline truncate block max-w-[190px]"
              >
                {base.name || "Untitled Base"}
              </Link>
              <div className="flex items-center gap-1 text-xs text-gray-600">
                {hovered && <TbDatabase className="text-gray-500" />}
                <span>{hovered ? "Open data" : createdLabel}</span>
              </div>
            </div>

            {(hovered || menuOpen) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleStar}
                  className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600"
                  aria-pressed={starred}
                  aria-label={starred ? "Unstar base" : "Star base"}
                >
                  <FiStar
                    className={`text-lg ${
                      starred ? "text-yellow-500 fill-yellow-500" : ""
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={toggleMenu}
                  className="h-9 w-9 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label="Open base menu"
                >
                  <FiMoreHorizontal className="text-lg" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute right-3 top-[56px] z-20 w-64 rounded-xl border border-gray-200 bg-white shadow-lg">
          <div className="py-2 text-sm text-gray-700">
            <MenuItem icon={<FiEdit2 />} label="Rename" onClick={closeMenu} />
            <MenuItem icon={<FiCopy />} label="Duplicate" onClick={closeMenu} />
            <MenuItem
              icon={<FiArrowRight />}
              label="Move"
              onClick={closeMenu}
            />
            <MenuItem
              icon={<FiUsers />}
              label="Go to workspace"
              onClick={closeMenu}
            />
            <MenuItem
              icon={<FiImage />}
              label="Customize appearance"
              onClick={closeMenu}
            />
            <div className="my-1 border-t" />
            <MenuItem
              icon={<FiTrash2 />}
              label="Delete"
              onClick={() => {
                closeMenu();
                onDelete?.(base.id);
              }}
              className="text-red-600 hover:text-red-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface MenuItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}

function MenuItem({ icon, label, onClick, className }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClick();
      }}
      className={`w-full px-4 py-2 flex items-center gap-3 hover:bg-gray-50 text-left ${className ?? ""}`}
    >
      <span className="text-gray-500">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
