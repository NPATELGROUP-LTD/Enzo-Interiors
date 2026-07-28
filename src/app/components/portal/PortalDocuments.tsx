import { useState } from "react";
import {
  Search,
  Filter,
  Download,
  Eye,
  FileText,
  Image,
  File,
} from "lucide-react";
import { usePageTitle } from "../../hooks/usePageTitle";
import { toast } from "sonner";

export function PortalDocuments() {
  usePageTitle("Documents");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("All");

  const documents = [
    {
      id: 1,
      name: "Kitchen Contract - Final.pdf",
      type: "Contract",
      date: "2024-03-15",
      size: "2.4 MB",
      icon: FileText,
    },
    {
      id: 2,
      name: "Initial Quote - Kitchen Renovation.pdf",
      type: "Quote",
      date: "2024-03-10",
      size: "1.8 MB",
      icon: FileText,
    },
    {
      id: 3,
      name: "Invoice #001.pdf",
      type: "Invoice",
      date: "2024-03-20",
      size: "1.2 MB",
      icon: FileText,
    },
    {
      id: 4,
      name: "Kitchen Floor Plan.pdf",
      type: "Plan",
      date: "2024-03-12",
      size: "3.1 MB",
      icon: File,
    },
    {
      id: 5,
      name: "Mood Board - Modern Kitchen.jpg",
      type: "Mood Board",
      date: "2024-03-08",
      size: "4.2 MB",
      icon: Image,
    },
  ];

  const filterOptions = [
    "All",
    "Contracts",
    "Quotes",
    "Invoices",
    "Plans",
    "Mood Boards",
  ];

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFilter =
      selectedFilter === "All" || doc.type === selectedFilter.slice(0, -1);
    return matchesSearch && matchesFilter;
  });

  const handleView = (doc: any) => {
    toast.success(`Opening ${doc.name}`);
  };

  const handleDownload = (doc: any) => {
    toast.success(`Downloading ${doc.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-cream/95 dark:bg-[#1C1C1A]/95 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            My Documents
          </h1>
        </div>

        {/* Search and Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sage-500 focus:border-transparent"
            />
          </div>

          {/* Filter Options */}
          <div className="flex gap-2 flex-wrap">
            {filterOptions.map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedFilter === filter
                    ? "bg-sage-500 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900 dark:text-white w-[45%]">
                File
              </th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900 dark:text-white w-[15%]">
                Type
              </th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900 dark:text-white w-[15%]">
                Date
              </th>
              <th className="text-left py-4 px-6 text-sm font-semibold text-gray-900 dark:text-white w-[10%]">
                Size
              </th>
              <th className="text-right py-4 px-6 text-sm font-semibold text-gray-900 dark:text-white w-[15%]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredDocuments.map((doc) => {
              const IconComponent = doc.icon;
              return (
                <tr
                  key={doc.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sage-100 dark:bg-sage-900/30 rounded-lg flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-sage-600 dark:text-sage-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {doc.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md">
                      {doc.type}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {new Date(doc.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {doc.size}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleView(doc)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-sage-600 dark:hover:text-sage-400 hover:bg-sage-50 dark:hover:bg-sage-900/20 rounded-lg transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(doc)}
                        className="p-2 text-gray-600 dark:text-gray-400 hover:text-sage-600 dark:hover:text-sage-400 hover:bg-sage-50 dark:hover:bg-sage-900/20 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredDocuments.length === 0 && (
          <div className="py-12 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || selectedFilter !== "All"
                ? "No documents match your search criteria."
                : "No documents available."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
