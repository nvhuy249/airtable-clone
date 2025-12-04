import Link from "next/link";
import { TbDatabase } from "react-icons/tb";

export interface Base {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

interface BaseCardProps {
  base: Base;
}

export default function BaseCard({ base }: BaseCardProps) {
  return (
    <Link
      href={`/base/${base.id}`}
      className="border p-5 rounded-xl bg-white shadow-sm hover:shadow-md hover:border-blue-500 transition"
    >
      <TbDatabase className="text-3xl text-blue-600" />
      <h2 className="mt-4 text-lg font-semibold">{base.name}</h2>
      <p className="text-sm text-gray-500 mt-1">Open base</p>
    </Link>
  );
}
