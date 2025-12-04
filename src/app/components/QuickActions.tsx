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
    <div className="grid grid-cols-4 gap-6 mt-8">
      {cards.map((c) => (
        <div
          key={c.title}
          className="bg-white border rounded-lg p-6 shadow-sm hover:shadow-md transition"
        >
          <h4 className="font-semibold text-gray-800">{c.title}</h4>
          <p className="text-gray-500 text-sm mt-2">{c.description}</p>
        </div>
      ))}
    </div>
  );
}
