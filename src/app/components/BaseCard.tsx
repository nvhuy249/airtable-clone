"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  tables: {id:string; name: string}[];
}

interface BaseCardProps {
  base: Base;
  onDelete?: (id: string) => void;
  onRenameStart?: (base: Base) => void;
  onRenameChange?: (value: string) => void;
  onRenameSubmit?: () => void;
  onRenameCancel?: () => void;
  isRenaming?: boolean;
  renameValue?: string;
  renamePending?: boolean;
}

function formatLastOpened(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Opened just now";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Opened just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Opened ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Opened ${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `Opened ${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `Opened ${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `Opened ${years} year${years === 1 ? "" : "s"} ago`;
}

export default function BaseCard({
  base,
  onDelete,
  onRenameStart,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  isRenaming,
  renameValue,
  renamePending,
}: BaseCardProps) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [starred, setStarred] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameSubmittedRef = useRef(false);
  const renameCancelledRef = useRef(false);
  const router = useRouter();

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
  const lastOpenedLabel = formatLastOpened(base.updatedAt ?? base.createdAt);

  useEffect(() => {
    if (!isRenaming) {
      renameSubmittedRef.current = false;
      renameCancelledRef.current = false;
      return;
    }

    setMenuOpen(false);
    setHovered(true);

    const id = window.setTimeout(() => {
      if (renameInputRef.current) {
        renameInputRef.current.focus();
        renameInputRef.current.select();
      }
    }, 0);

    return () => window.clearTimeout(id);
  }, [isRenaming]);

  const submitRename = () => {
    if (renameSubmittedRef.current || renameCancelledRef.current) return;
    renameSubmittedRef.current = true;
    onRenameSubmit?.();
  };

  const cancelRename = () => {
    renameCancelledRef.current = true;
    onRenameCancel?.();
  };

  const handleCardClick = () => {
    if (isRenaming) return;
    void router.push(`/base/${base.id}`);
  };

  return (
    <div
      className={`relative border rounded-xl bg-white transition shadow-sm w-full max-w-[300px] min-h-[70px] ${
        hovered || menuOpen ? "shadow-md border-[#c2cad8] bg-[#e8edf3]" : "border-[#e6e8eb]"
      } hover:bg-[#e8edf3]`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
    >
      <div className="relative z-10 flex items-start gap-3 p-5">
        <div className="h-9 w-9 rounded-lg bg-[#eef2f7] text-[#4b5563] flex items-center justify-center text-[13px] font-semibold border border-[#e6e8eb]">
          {initials}
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              {!isRenaming ? (
                <Link
                  href={`/base/${base.id}`}
                  className="text-[14px] font-medium text-[#1f2933] hover:underline truncate block max-w-[190px]"
                >
                  {base.name || "Untitled Base"}
                </Link>
              ) : (
                <input
                  ref={renameInputRef}
                  value={renameValue ?? base.name ?? "Untitled Base"}
                  onChange={(e) => onRenameChange?.(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      submitRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onBlur={submitRename}
                  aria-label="Rename base"
                  className="text-[14px] font-medium text-[#1f2933] bg-white border border-[#5c9bfd] rounded px-2 py-1 w-full max-w-[200px] outline-none shadow-[0_0_0_2px_rgba(92,155,253,0.15)]"
                  disabled={renamePending}
                  data-rename-field="true"
                />
              )}
              <div className="flex items-center gap-1 text-[12px] text-[#6b7280]">
                {hovered && <TbDatabase className="text-[#6b7280]" />}
                <span className="truncate">{hovered ? "Open data" : lastOpenedLabel}</span>
              </div>
            </div>

            {(hovered || menuOpen) && !isRenaming && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleStar}
                  className="h-8 w-8 rounded-full border border-[#e6e8eb] flex items-center justify-center hover:bg-[#f2f4f7] text-[#6b7280]"
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
                  className="h-8 w-8 rounded-full border border-[#e6e8eb] flex items-center justify-center hover:bg-[#f2f4f7] text-[#6b7280]"
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
        <div className="absolute right-3 top-[56px] z-20 w-64 rounded-xl border border-[#e6e8eb] bg-white shadow-lg">
          <div className="py-2 text-sm text-[#1f2933]">
            <MenuItem
              icon={<FiEdit2 />}
              label="Rename"
              onClick={() => {
                closeMenu();
                onRenameStart?.(base);
              }}
            />
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
            <div className="my-1 border-t border-[#e6e8eb]" />
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
