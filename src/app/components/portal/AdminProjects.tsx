import { useState } from "react";
import { useOutletContext } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { List, LayoutGrid, X, Plus, Edit2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePageTitle } from "../../hooks/usePageTitle";

const stages = [
  "Consultation",
  "Design",
  "Approval",
  "Installation",
  "Completed",
];

// Project-type specific workflows
const projectTypeStages: Record<string, string[]> = {
  Kitchen: [
    "Consultation",
    "Design",
    "Approval",
    "Manufacturing",
    "Installation",
    "Completion",
  ],
  Bedroom: [
    "Consultation",
    "Design",
    "Manufacturing",
    "Installation",
    "Snagging",
    "Completion",
  ],
  "Media Wall": ["Consultation", "Design", "Installation", "Completion"],
  Wardrobe: [
    "Consultation",
    "Design",
    "Manufacturing",
    "Installation",
    "Completion",
  ],
  // Default for other types
  Default: ["Consultation", "Design", "Approval", "Installation", "Completed"],
};

// Helper to get stages for a project type
const getStagesForType = (projectType: string): string[] => {
  return projectTypeStages[projectType] || projectTypeStages.Default;
};

type Project = {
  id: number;
  client: string;
  name: string;
  service: string;
  stage: string;
  days: number;
  avatar: string;
  customStages?: string[];
};

const initialProjects: Project[] = [
  {
    id: 1,
    client: "Sarah Thompson",
    name: "Main Bedroom Renovation",
    service: "Bedroom",
    stage: "Design",
    days: 5,
    avatar: "ST",
  },
  {
    id: 2,
    client: "James Mitchell",
    name: "Kitchen Redesign",
    service: "Kitchen",
    stage: "Consultation",
    days: 2,
    avatar: "JM",
  },
  {
    id: 3,
    client: "Emma Richardson",
    name: "Media Wall Install",
    service: "Media Wall",
    stage: "Approval",
    days: 3,
    avatar: "ER",
  },
  {
    id: 4,
    client: "David Chen",
    name: "Walk-in Wardrobe",
    service: "Wardrobe",
    stage: "Installation",
    days: 1,
    avatar: "DC",
    customStages: [
      "Consultation",
      "Design",
      "Manufacturing",
      "Installation",
      "Final Review",
      "Completion",
    ],
  },
  {
    id: 5,
    client: "Rachel Adams",
    name: "Full Home Renovation",
    service: "Kitchen",
    stage: "Completed",
    days: 0,
    avatar: "RA",
  },
  {
    id: 6,
    client: "Priya Patel",
    name: "Sage Green Kitchen",
    service: "Kitchen",
    stage: "Design",
    days: 8,
    avatar: "PP",
  },
  {
    id: 7,
    client: "Tom Bailey",
    name: "Media Wall + Storage",
    service: "Media Wall",
    stage: "Consultation",
    days: 1,
    avatar: "TB",
  },
];

interface DraggableCardProps {
  project: Project;
  darkMode: boolean;
  onClick: () => void;
  index: number;
}

function DraggableCard({
  project,
  darkMode,
  onClick,
  index,
}: DraggableCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "PROJECT",
    item: { id: project.id, stage: project.stage },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";

  return (
    <motion.div
      ref={drag}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`${c} border rounded-xl p-4 cursor-move hover:-translate-y-0.5 transition-transform ${isDragging ? "rotate-2 scale-105" : ""}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[8px] text-white ${darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]"}`}
        >
          {project.avatar}
        </div>
        <span className={`text-[11px] ${t2}`}>{project.client}</span>
      </div>
      <p className={`text-[13px] ${t1}`} style={{ fontWeight: 500 }}>
        {project.name}
      </p>
      <div className="flex items-center justify-between mt-3">
        <span
          className={`px-2 py-0.5 rounded-full text-[9px] ${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
        >
          {project.service}
        </span>
        {project.days > 0 && (
          <span className={`text-[10px] ${t2}`}>{project.days}d in stage</span>
        )}
      </div>
    </motion.div>
  );
}

interface DroppableColumnProps {
  stage: string;
  projects: Project[];
  darkMode: boolean;
  onDrop: (projectId: number, newStage: string) => void;
  onCardClick: (project: Project) => void;
}

function DroppableColumn({
  stage,
  projects,
  darkMode,
  onDrop,
  onCardClick,
}: DroppableColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: "PROJECT",
    drop: (item: { id: number; stage: string }) => {
      if (item.stage !== stage) {
        onDrop(item.id, stage);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";

  return (
    <div
      ref={drop}
      className={`min-w-[260px] flex-shrink-0 rounded-2xl border p-4 transition-all ${isOver ? "ring-2 ring-[#4A8C5C]" : ""} ${darkMode ? "bg-[#1C1C1A] border-[#2A2A28]" : "bg-white border-[#C4B8A8]/20"}`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-[12px] ${t1}`} style={{ fontWeight: 500 }}>
          {stage}
        </span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full ${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
        >
          {projects.length}
        </span>
      </div>
      <div
        className={`space-y-3 min-h-[100px] transition-colors ${isOver ? (darkMode ? "bg-[#4A8C5C]/10 rounded-lg p-1" : "bg-[#1C4A3A]/5 rounded-lg p-1") : ""}`}
      >
        {projects.map((p, i) => (
          <DraggableCard
            key={p.id}
            project={p}
            darkMode={darkMode}
            onClick={() => onCardClick(p)}
            index={i}
          />
        ))}
      </div>
    </div>
  );
}

export function AdminProjects() {
  usePageTitle("Projects - Admin Portal");
  const { darkMode } = useOutletContext<{ darkMode: boolean }>();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [createModal, setCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "costs">("details");
  const [serviceFilter, setServiceFilter] = useState<string>("All");
  const [newProject, setNewProject] = useState({
    client: "",
    name: "",
    service: "Kitchen",
    customStages: getStagesForType("Kitchen"),
  });

  // Update custom stages when service type changes
  const handleServiceChange = (service: string) => {
    setNewProject({
      ...newProject,
      service,
      customStages: getStagesForType(service),
    });
  };

  const addCustomStage = () => {
    setNewProject({
      ...newProject,
      customStages: [...newProject.customStages, "New Stage"],
    });
  };

  const removeCustomStage = (index: number) => {
    setNewProject({
      ...newProject,
      customStages: newProject.customStages.filter((_, i) => i !== index),
    });
  };

  const updateCustomStage = (index: number, value: string) => {
    setNewProject({
      ...newProject,
      customStages: newProject.customStages.map((s, i) =>
        i === index ? value : s,
      ),
    });
  };

  const moveProject = (projectId: number, newStage: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, stage: newStage, days: 0 } : p,
      ),
    );
    toast.success(`Project moved to ${newStage}`);
  };

  // Get unique services for filter
  const allServices = [
    "All",
    ...Array.from(new Set(projects.map((p) => p.service))),
  ];

  // Filter projects by service
  const filteredProjects =
    serviceFilter === "All"
      ? projects
      : projects.filter((p) => p.service === serviceFilter);

  // Get stages based on filter - accounting for custom stages
  const getAllStagesForFiltered = (): string[] => {
    if (serviceFilter === "All") {
      // Gather all unique stages from all projects
      const allStagesSet = new Set<string>();
      filteredProjects.forEach((p) => {
        const projectStages = p.customStages || getStagesForType(p.service);
        projectStages.forEach((s) => allStagesSet.add(s));
      });
      return Array.from(allStagesSet);
    } else {
      // For specific service, check if any project has custom stages
      const customStagesProject = filteredProjects.find((p) => p.customStages);
      if (customStagesProject?.customStages) {
        // Use custom stages from first project with custom stages
        return customStagesProject.customStages;
      }
      return getStagesForType(serviceFilter);
    }
  };

  const displayStages = getAllStagesForFiltered();
  const c = darkMode
    ? "bg-[#1C1C1A] border-[#2A2A28]"
    : "bg-white border-[#C4B8A8]/20";
  const t1 = darkMode ? "text-[#F0EEE9]" : "text-[#1E1E1C]";
  const t2 = darkMode ? "text-[#8A8A82]" : "text-[#6B6B65]";
  const acc = darkMode ? "text-[#4A8C5C]" : "text-[#1C4A3A]";
  const accBg = darkMode ? "bg-[#4A8C5C]" : "bg-[#1C4A3A]";
  const inp = darkMode
    ? "bg-[#2A2A28] border-[#2A2A28] text-[#F0EEE9] placeholder-[#8A8A82]"
    : "bg-[#F5F4F0] border-[#C4B8A8] text-[#2C2C2C] placeholder-[#C4B8A8]";

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = Math.max(...projects.map((p) => p.id)) + 1;
    const createdProject: Project = {
      id: newId,
      client: newProject.client,
      name: newProject.name,
      service: newProject.service,
      stage: newProject.customStages[0],
      days: 0,
      avatar: newProject.client
        .split(" ")
        .map((n) => n[0])
        .join(""),
      customStages: newProject.customStages,
    };
    setProjects([...projects, createdProject]);
    toast.success(`Project "${newProject.name}" created!`);
    setCreateModal(false);
    setNewProject({
      client: "",
      name: "",
      service: "Kitchen",
      customStages: getStagesForType("Kitchen"),
    });
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div>
        <div className="flex items-center justify-between mb-8">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={t1}
            style={{ fontSize: "1.8rem" }}
          >
            Projects
          </motion.h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCreateModal(true)}
              className={`px-4 py-2 rounded-full text-[12px] text-white flex items-center gap-1 ${accBg}`}
            >
              <Plus size={12} /> New Project
            </button>
            <button
              onClick={() => setView("kanban")}
              className={`p-2 rounded-lg ${view === "kanban" ? (darkMode ? "bg-[#2A2A28]" : "bg-[#EAE7E0]") : ""}`}
            >
              <LayoutGrid size={16} className={view === "kanban" ? acc : t2} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-2 rounded-lg ${view === "list" ? (darkMode ? "bg-[#2A2A28]" : "bg-[#EAE7E0]") : ""}`}
            >
              <List size={16} className={view === "list" ? acc : t2} />
            </button>
          </div>
        </div>

        {/* Service filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {allServices.map((service) => (
            <button
              key={service}
              onClick={() => setServiceFilter(service)}
              className={`px-4 py-1.5 rounded-full text-[12px] transition-all ${
                serviceFilter === service
                  ? darkMode
                    ? "bg-[#4A8C5C] text-white"
                    : "bg-[#1C4A3A] text-white"
                  : darkMode
                    ? "bg-[#2A2A28] text-[#8A8A82] hover:text-[#F0EEE9]"
                    : "bg-[#EAE7E0] text-[#6B6B65] hover:text-[#1C4A3A]"
              }`}
            >
              {service}
            </button>
          ))}
        </div>

        {view === "kanban" ? (
          <div className="flex flex-wrap gap-4 pb-4 h-[calc(100vh-320px)] overflow-y-auto">
            {displayStages.map((stage) => {
              const stageProjects = filteredProjects.filter(
                (p) => p.stage === stage,
              );
              return (
                <DroppableColumn
                  key={stage}
                  stage={stage}
                  projects={stageProjects}
                  darkMode={darkMode}
                  onDrop={moveProject}
                  onCardClick={setSelectedProject}
                />
              );
            })}
          </div>
        ) : (
          <div className={`${c} border rounded-2xl overflow-hidden`}>
            <table className="w-full">
              <thead>
                <tr
                  className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/20"}`}
                >
                  {["Project", "Client", "Service", "Stage", "Days"].map(
                    (h) => (
                      <th
                        key={h}
                        className={`text-left text-[11px] uppercase tracking-wider ${t2} px-4 py-3`}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map((p, i) => (
                  <tr
                    key={p.id}
                    className={`border-b ${darkMode ? "border-[#2A2A28]" : "border-[#C4B8A8]/10"} ${darkMode ? "hover:bg-[#2A2A28]/50" : "hover:bg-[#F5F4F0]"} transition-colors cursor-pointer`}
                    onClick={() => setSelectedProject(p)}
                  >
                    <td className={`px-4 py-3 text-[13px] ${t1}`}>{p.name}</td>
                    <td className={`px-4 py-3 text-[12px] ${t2}`}>
                      {p.client}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] ${darkMode ? "bg-[#2A2A28] text-[#8A8A82]" : "bg-[#EAE7E0] text-[#6B6B65]"}`}
                      >
                        {p.service}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] ${p.stage === "Completed" ? "bg-[#8A9E8C]/20 text-[#8A9E8C]" : darkMode ? "bg-[#4A8C5C]/20 text-[#4A8C5C]" : "bg-[#1C4A3A]/10 text-[#1C4A3A]"}`}
                      >
                        {p.stage}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-[12px] ${t2}`}>
                      {p.days > 0 ? `${p.days}d` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Project Detail Modal */}
        <AnimatePresence>
          {selectedProject && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setSelectedProject(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-lg w-full p-6`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                    {selectedProject.name}
                  </h3>
                  <button onClick={() => setSelectedProject(null)}>
                    <X size={18} className={t2} />
                  </button>
                </div>

                {/* Tabs */}
                <div
                  className="flex gap-2 mb-6 border-b"
                  style={{ borderColor: darkMode ? "#2A2A28" : "#C4B8A8" }}
                >
                  <button
                    onClick={() => setActiveTab("details")}
                    className={`pb-2 px-3 text-[13px] transition-colors ${
                      activeTab === "details" ? `${acc} border-b-2` : t2
                    }`}
                    style={{
                      borderColor:
                        activeTab === "details"
                          ? darkMode
                            ? "#4A8C5C"
                            : "#1C4A3A"
                          : "transparent",
                    }}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab("costs")}
                    className={`pb-2 px-3 text-[13px] transition-colors flex items-center gap-1 ${
                      activeTab === "costs" ? `${acc} border-b-2` : t2
                    }`}
                    style={{
                      borderColor:
                        activeTab === "costs"
                          ? darkMode
                            ? "#4A8C5C"
                            : "#1C4A3A"
                          : "transparent",
                    }}
                  >
                    <TrendingUp size={12} /> Costs
                  </button>
                </div>

                {activeTab === "details" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-[12px] text-white ${accBg}`}
                      >
                        {selectedProject.avatar}
                      </div>
                      <div>
                        <p
                          className={`text-[14px] ${t1}`}
                          style={{ fontWeight: 500 }}
                        >
                          {selectedProject.client}
                        </p>
                        <p className={`text-[12px] ${t2}`}>
                          {selectedProject.service}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className={`text-[11px] ${t2}`}>
                          Current Stage
                        </span>
                        <select
                          defaultValue={selectedProject.stage}
                          onChange={(e) =>
                            toast.success(`Stage updated to ${e.target.value}`)
                          }
                          className={`w-full mt-1 px-3 py-2 rounded-lg border text-[13px] focus:outline-none ${inp}`}
                        >
                          {stages.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className={`text-[11px] ${t2}`}>
                          Days in Stage
                        </span>
                        <p
                          className={`text-[16px] ${t1} mt-1`}
                          style={{ fontWeight: 600 }}
                        >
                          {selectedProject.days > 0
                            ? `${selectedProject.days} days`
                            : "Completed"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className={`text-[11px] ${t2}`}>Progress</span>
                      <div
                        className={`mt-2 h-2 rounded-full ${darkMode ? "bg-[#2A2A28]" : "bg-[#EAE7E0]"}`}
                      >
                        <div
                          className={`h-full rounded-full ${accBg}`}
                          style={{
                            width: `${(stages.indexOf(selectedProject.stage) / (stages.length - 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <span className={`text-[11px] ${t2} block mb-1`}>
                        Notes
                      </span>
                      <textarea
                        rows={3}
                        placeholder="Add project notes..."
                        className={`w-full px-3 py-2 rounded-xl border text-[13px] focus:outline-none resize-none ${inp}`}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div
                        className={`p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
                      >
                        <p
                          className={`text-[10px] ${t2} uppercase tracking-wider`}
                        >
                          Budget
                        </p>
                        <p
                          className={`text-[18px] ${t1} mt-1`}
                          style={{ fontWeight: 600 }}
                        >
                          £12,500
                        </p>
                      </div>
                      <div
                        className={`p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
                      >
                        <p
                          className={`text-[10px] ${t2} uppercase tracking-wider`}
                        >
                          Spent
                        </p>
                        <p
                          className={`text-[18px] ${t1} mt-1`}
                          style={{ fontWeight: 600 }}
                        >
                          £8,340
                        </p>
                      </div>
                      <div
                        className={`p-4 rounded-xl ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
                      >
                        <p
                          className={`text-[10px] ${t2} uppercase tracking-wider`}
                        >
                          Remaining
                        </p>
                        <p
                          className={`text-[18px] ${acc} mt-1`}
                          style={{ fontWeight: 600 }}
                        >
                          £4,160
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className={`text-[11px] ${t2} mb-3`}>Cost Breakdown</p>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={[
                              { week: "Week 1", cost: 1200 },
                              { week: "Week 2", cost: 2800 },
                              { week: "Week 3", cost: 5200 },
                              { week: "Week 4", cost: 7100 },
                              { week: "Week 5", cost: 8340 },
                            ]}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={darkMode ? "#2A2A28" : "#E5E5E5"}
                            />
                            <XAxis
                              dataKey="week"
                              tick={{
                                fill: darkMode ? "#8A8A82" : "#6B6B65",
                                fontSize: 11,
                              }}
                            />
                            <YAxis
                              tick={{
                                fill: darkMode ? "#8A8A82" : "#6B6B65",
                                fontSize: 11,
                              }}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: darkMode ? "#1C1C1A" : "#FFF",
                                border: `1px solid ${darkMode ? "#2A2A28" : "#C4B8A8"}`,
                                borderRadius: "8px",
                              }}
                              labelStyle={{
                                color: darkMode ? "#F0EEE9" : "#1E1E1C",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="cost"
                              stroke={darkMode ? "#4A8C5C" : "#1C4A3A"}
                              strokeWidth={2}
                              dot={{ fill: darkMode ? "#4A8C5C" : "#1C4A3A" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className={`text-[11px] ${t2}`}>Recent Expenses</p>
                      {[
                        { item: "Materials", amount: 2400, date: "Mar 10" },
                        { item: "Labor", amount: 3200, date: "Mar 8" },
                        { item: "Fixtures", amount: 1540, date: "Mar 5" },
                      ].map((expense, i) => (
                        <div
                          key={i}
                          className={`flex items-center justify-between p-3 rounded-lg ${darkMode ? "bg-[#2A2A28]" : "bg-[#F5F4F0]"}`}
                        >
                          <div>
                            <p className={`text-[12px] ${t1}`}>
                              {expense.item}
                            </p>
                            <p className={`text-[10px] ${t2}`}>
                              {expense.date}
                            </p>
                          </div>
                          <p
                            className={`text-[13px] ${t1}`}
                            style={{ fontWeight: 600 }}
                          >
                            £{expense.amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => toast.success("Opening messages...")}
                    className={`flex-1 py-2.5 rounded-full text-[13px] text-white ${accBg}`}
                  >
                    Message Client
                  </button>
                  <button
                    onClick={() => toast.success("Opening files...")}
                    className={`flex-1 py-2.5 rounded-full text-[13px] border ${darkMode ? "border-[#2A2A28] text-[#8A8A82]" : "border-[#C4B8A8] text-[#6B6B65]"}`}
                  >
                    Upload Files
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Project Modal */}
        <AnimatePresence>
          {createModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                className={`${darkMode ? "bg-[#1C1C1A]" : "bg-white"} rounded-2xl max-w-md w-full p-6`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className={t1} style={{ fontSize: "1.2rem" }}>
                    New Project
                  </h3>
                  <button onClick={() => setCreateModal(false)}>
                    <X size={18} className={t2} />
                  </button>
                </div>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Client
                    </label>
                    <select
                      required
                      value={newProject.client}
                      onChange={(e) =>
                        setNewProject({ ...newProject, client: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    >
                      <option value="">Select client...</option>
                      <option>Sarah Thompson</option>
                      <option>James Mitchell</option>
                      <option>Emma Richardson</option>
                      <option>David Chen</option>
                      <option>Priya Patel</option>
                      <option>Tom Bailey</option>
                    </select>
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Project Name
                    </label>
                    <input
                      required
                      value={newProject.name}
                      onChange={(e) =>
                        setNewProject({ ...newProject, name: e.target.value })
                      }
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                      placeholder="Project name"
                    />
                  </div>
                  <div>
                    <label className={`text-[12px] ${t2} block mb-1`}>
                      Service Type
                    </label>
                    <select
                      value={newProject.service}
                      onChange={(e) => handleServiceChange(e.target.value)}
                      className={`w-full px-4 py-3 rounded-xl border text-[13px] focus:outline-none ${inp}`}
                    >
                      <option>Kitchen</option>
                      <option>Bedroom</option>
                      <option>Media Wall</option>
                      <option>Wardrobe</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={`text-[12px] ${t2}`}>
                        Project Workflow
                      </label>
                      <button
                        type="button"
                        onClick={addCustomStage}
                        className={`text-[11px] px-2 py-1 rounded-md ${darkMode ? "bg-[#2A2A28] text-[#8A8A82] hover:text-[#F0EEE9]" : "bg-[#EAE7E0] text-[#6B6B65] hover:text-[#1C4A3A]"}`}
                      >
                        <Plus size={12} className="inline" /> Add Stage
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {newProject.customStages.map((stage, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            value={stage}
                            onChange={(e) =>
                              updateCustomStage(index, e.target.value)
                            }
                            className={`flex-1 px-3 py-2 rounded-lg border text-[12px] focus:outline-none ${inp}`}
                            placeholder="Stage name"
                          />
                          {newProject.customStages.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeCustomStage(index)}
                              className={`p-2 rounded-lg ${darkMode ? "hover:bg-[#2A2A28] text-red-500" : "hover:bg-[#EAE7E0] text-red-500"}`}
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className={`text-[10px] ${t2} mt-2`}>
                      {newProject.customStages.length} stages • Projects move
                      through these stages in order
                    </p>
                  </div>
                  <button
                    type="submit"
                    className={`w-full py-3 rounded-full text-[14px] text-white ${accBg}`}
                  >
                    Create Project
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DndProvider>
  );
}
