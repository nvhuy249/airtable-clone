"use client";

import { useState } from "react";
import AppRail from "./components/AppRail";
import TableTopBar from "./components/TableTopBar";
import TableToolbar from "./components/TableToolbar";
import ViewSidebar from "./components/ViewSidebar";
import BaseTable from "./components/BaseTable";

interface BaseClientProps {
  baseId: string;
  baseName: string;
  tables: { id: string; name: string }[];
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function BaseClient({
  baseId,
  baseName,
  tables,
  user,
}: BaseClientProps) {
  const userInitial =
    user?.name?.charAt(0)?.toUpperCase() ??
    user?.email?.charAt(0)?.toUpperCase() ??
    "U";
  const [activeTableId, setActiveTableId] = useState(
    tables[0]?.id ?? baseId,
  );

  return (
    <div className="flex h-screen bg-[#f7f7fb]">
      {/* LEFT APP RAIL */}
      <AppRail userInitial={userInitial} />

      {/* RIGHT MAIN AREA */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOP BAR = logo + base name + Data/Automations/Interfaces/Forms + right buttons */}
        <div className="flex items-center justify-between px-5 py-3 border border-gray-200 bg-white">
          {/* LEFT: logo + base name */}
          <div className="flex items-center gap-3 min-w-[220px]">
            <img
              src="/airtable-logo.png"
              alt=""
              className="h-7 w-7 rounded border border-gray-300 p-1 cursor-pointer"
              onClick={() => (window.location.href = "/")}
            />
            <div className="font-semibold text-sm">{baseName}</div>
          </div>

          {/* CENTER: Data / Automations / Interfaces / Forms */}
          <div className="flex-1 flex justify-center">
            <div className="flex gap-5 text-sm text-gray-600">
              <button className="pb-[8px] border-b-2 border-black font-medium text-black">
                Data
              </button>
              <button className="pb-[8px] hover:text-black">Automations</button>
              <button className="pb-[8px] hover:text-black">Interfaces</button>
              <button className="pb-[8px] hover:text-black">Forms</button>
            </div>
          </div>

          {/* RIGHT: trial / launch / share */}
          <div className="flex items-center gap-2 text-xs">
            <div className="px-3 py-1 rounded-full border border-gray-300 bg-gray-50">
              Trial: 13 days left
            </div>
            <button className="px-3 py-1 border rounded-full">Launch</button>
            <button className="px-3 py-1 border rounded-full font-medium">
              Share
            </button>
          </div>
        </div>

        {/* TABLE HEADER STRIP = table switcher + toolbar */}
        <TableTopBar
          tables={tables}
          activeTableId={activeTableId}
          onChangeTable={setActiveTableId}
        />

        <TableToolbar />

        {/* BODY: view sidebar + table */}
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT: view sidebar */}
          <ViewSidebar />

          {/* RIGHT: table + bottom bar */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <BaseTable />
          </div>
        </div>
      </div>
    </div>
  );
}
