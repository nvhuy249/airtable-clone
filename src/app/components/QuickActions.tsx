const cards = [
  {
    title: "Start with Omni",
    description: "Use AI to build a custom app tailored to your workflow",
  },
  {
    title: "Start with templates",
    description: "Select a template to get started and customize as you go",
  },
  {
    title: "Quickly upload",
    description: "Easily migrate your existing projects in a few minutes",
  },
  {
    title: "Build an app on your own",
    description: "Start with a blank app and build your ideal workflow",
  },
];

export default function QuickActions() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div
          key={c.title}
          className="bg-white border border-[#e6e8eb] rounded-lg p-4 shadow-sm hover:shadow-md hover:-translate-y-[1px] transition"
        >
          <h4 className="font-medium text-[#1f2933] text-[14px]">{c.title}</h4>
          <p className="text-[#6b7280] text-[13px] mt-2 leading-relaxed">{c.description}</p>
        </div>
      ))}
    </div>
  );
}
