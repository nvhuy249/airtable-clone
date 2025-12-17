export default function Banner() {
  return (
    <div className="bg-white border border-[#e6e8eb] rounded-xl p-4 flex items-center justify-between shadow-sm">
      <div>
        <h3 className="font-semibold text-[#1f2933] text-[15px]">
          Upgrade to the Team plan before your trial expires in <span className="text-blue-600">14 days</span>
        </h3>
        <p className="text-[#6b7280] mt-1 text-[13px]">
          Keep the power you need to manage complex workflows, design interfaces, and more.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <button className="px-4 py-2 bg-[#111827] text-white rounded-full hover:bg-[#0f172a] transition text-[13px] shadow-sm">
            Upgrade
          </button>
          <button className="text-[#4b5563] hover:underline text-[13px]">Compare plans</button>
        </div>
      </div>
    </div>
  );
}
