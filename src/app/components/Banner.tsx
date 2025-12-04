export default function Banner() {
  return (
    <div className="bg-white border rounded-xl p-6 flex items-center justify-between shadow">
      <div>
        <h3 className="font-semibold text-gray-800">
          Upgrade to the Team plan before your trial expires in <span className="text-blue-600">14 days</span>
        </h3>
        <p className="text-gray-500 mt-1">
          Keep the power you need to manage complex workflows, design interfaces, and more.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <button className="px-5 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition">
            Upgrade
          </button>
          <button className="text-gray-600 hover:underline">Compare plans</button>
        </div>
      </div>
    </div>
  );
}
