"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface CreateBaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreateEmptyBase: () => void;
}

export default function CreateBaseModal({
  open,
  onClose,
  onCreateEmptyBase,
}: CreateBaseModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* BACKDROP */}
          <motion.div
            className="fixed inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* MODAL */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed z-50 bg-white rounded-xl shadow-xl p-6 w-[680px] left-1/2 top-[20%] -translate-x-1/2"
          >
            {/* HEADER */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">How do you want to start?</h2>

              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* OPTIONS */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border border-gray-300 rounded-lg p-4 hover:shadow-md cursor-pointer transition">
                <Image
                  src="/omni-preview.png"
                  alt="omni"
                  width={260}
                  height={150}
                  className="rounded-md"
                />

                <p className="font-semibold mt-2">Build an app with Omni</p>
                <p className="text-sm text-gray-500">
                  Use AI to build a custom app tailored to your workflow.
                </p>
              </div>

              {/* EMPTY BASE */}
              <button
                className="border border-gray-300 rounded-lg p-4 hover:shadow-md transition text-left"
                onClick={onCreateEmptyBase}
              >
                <Image
                  src="/blank-base.png"
                  alt="blank base"
                  width={260}
                  height={150}
                  className="rounded-md"
                />

                <p className="font-semibold mt-2">Build an app on your own</p>
                <p className="text-sm text-gray-500">
                  Start with a blank app and build your ideal workflow.
                </p>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
