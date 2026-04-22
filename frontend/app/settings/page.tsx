"use client";

import { useState, useEffect, useCallback } from "react";
import { FiHome, FiUser, FiSettings } from "react-icons/fi";
import {
  Database, Download, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, Clock, HardDrive, Shield, FileArchive,
  Loader2, Info, ChevronRight, Server, Settings2,
} from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";

// ── types ─────────────────────────────────────────────────────────────────────
type BackupFile   = { name: string; size: number; created: string };
type BackupStatus = "idle" | "running" | "success" | "error";
type Tab          = "backup" | "system";

// ── helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024, sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (mins  < 1)  return "just now";
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── component ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab,     setActiveTab]     = useState<Tab>("backup");
  const [backups,       setBackups]       = useState<BackupFile[]>([]);
  const [loadingList,   setLoadingList]   = useState(true);
  const [backupStatus,  setBackupStatus]  = useState<BackupStatus>("idle");
  const [backupMessage, setBackupMessage] = useState("");
  const [deletingFile,  setDeletingFile]  = useState<string | null>(null);

  // ── load list ──────────────────────────────────────────────────────────────
  const loadBackups = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/backup`, { credentials: "include" });
      if (res.ok) { const d = await res.json(); setBackups(d.backups || []); }
    } catch { /* ignore */ }
    finally { setLoadingList(false); }
  }, []);

  useEffect(() => { loadBackups(); }, [loadBackups]);

  const lastBackup = backups[0] ?? null;

  // ── create backup ──────────────────────────────────────────────────────────
  const handleBackup = async () => {
    setBackupStatus("running");
    setBackupMessage("");
    try {
      const res  = await fetch(`${API_BASE_URL}/api/backup`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) {
        setBackupStatus("success");
        setBackupMessage(`Saved: ${data.fileName}  (${formatBytes(data.sizeBytes)})`);
        await loadBackups();
      } else {
        setBackupStatus("error");
        setBackupMessage(data.error || "Backup failed");
      }
    } catch {
      setBackupStatus("error");
      setBackupMessage("Network error — could not reach server");
    }
    setTimeout(() => { setBackupStatus("idle"); setBackupMessage(""); }, 7000);
  };

  // ── download ───────────────────────────────────────────────────────────────
  const handleDownload = (fileName: string) => {
    const a = document.createElement("a");
    a.href = `${API_BASE_URL}/api/backup?download=${encodeURIComponent(fileName)}`;
    a.download = fileName;
    a.click();
  };

  // ── delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (fileName: string) => {
    if (!confirm(`Delete backup:\n"${fileName}"?\n\nThis cannot be undone.`)) return;
    setDeletingFile(fileName);
    try {
      const res = await fetch(`${API_BASE_URL}/api/backup`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (res.ok) await loadBackups();
      else { const d = await res.json(); alert(d.error || "Delete failed"); }
    } finally { setDeletingFile(null); }
  };

  // ── sidebar items ──────────────────────────────────────────────────────────
  const tabs: { key: Tab; icon: any; label: string }[] = [
    { key: "backup", icon: Database, label: "Database Backup" },
    { key: "system", icon: Server,   label: "System Info"     },
  ];

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top bar — same style as your existing navbar ─────────────────── */}
      <header className="bg-gradient-to-r from-blue-600 to-teal-500 text-white px-4 py-3 shadow-md print:hidden">
        <div className="flex items-center justify-between max-w-6xl mx-auto">

          {/* Left: breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-blue-100">
            <a href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <FiHome size={15} />
              Dashboard
            </a>
            <ChevronRight size={13} className="opacity-50" />
            <span className="text-white font-semibold flex items-center gap-1.5">
              <Settings2 size={15} />
              Settings
            </span>
          </div>

          {/* Right: quick-nav icons — same as your main navbar */}
          <div className="flex items-center gap-4">
            <a href="/"        title="Dashboard" className="text-white hover:opacity-80"><FiHome     size={22} /></a>
            <a href="/profile" title="Profile"   className="text-white hover:opacity-80"><FiUser     size={22} /></a>
            <a href="/settings" title="Settings" className="text-white opacity-80 pointer-events-none"><FiSettings size={22} /></a>
            <span className="font-semibold text-lg tracking-wide text-slate-100">Purchase Order System</span>
          </div>
        </div>
      </header>

      {/* ── Page title strip ─────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <Settings2 size={18} className="text-blue-600" />
          <h1 className="text-base font-bold text-gray-800">System Settings</h1>
          <span className="text-gray-300 text-sm mx-1">|</span>
          <span className="text-sm text-gray-500">Manage database backups and system configuration</span>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 flex gap-5">

        {/* Sidebar */}
        <aside className="w-52 shrink-0">
          <nav className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden sticky top-6">
            {tabs.map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-left transition-colors border-b border-gray-100 last:border-0 ${
                  activeTab === key
                    ? "bg-blue-50 text-blue-700 border-l-[3px] border-l-blue-600"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <Icon size={16} />
                <span className="flex-1">{label}</span>
                {activeTab === key && <ChevronRight size={14} className="text-blue-400" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 space-y-5">

          {/* ════════════════════════════════════════
              TAB: DATABASE BACKUP
          ════════════════════════════════════════ */}
          {activeTab === "backup" && (
            <>
              {/* Action card */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3 flex items-center gap-2">
                  <Database size={15} className="text-blue-600" />
                  <h2 className="font-semibold text-gray-800 text-sm">Create Database Backup</h2>
                </div>
                <div className="p-5">

                  {/* Status banner */}
                  {backupStatus !== "idle" && (
                    <div className={`mb-4 flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm font-medium ${
                      backupStatus === "running" ? "bg-blue-50  text-blue-700  border border-blue-200"
                      : backupStatus === "success" ? "bg-green-50 text-green-700 border border-green-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                    }`}>
                      {backupStatus === "running" && <Loader2      size={16} className="animate-spin mt-0.5 shrink-0" />}
                      {backupStatus === "success" && <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                      {backupStatus === "error"   && <AlertCircle  size={16} className="mt-0.5 shrink-0" />}
                      <span>
                        {backupStatus === "running"
                          ? "Running pg_dump… please wait"
                          : backupMessage}
                      </span>
                    </div>
                  )}

                  {/* Stat cards */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      {
                        label: "Last Backup",
                        value: lastBackup ? relativeTime(lastBackup.created) : "Never",
                        sub:   lastBackup ? formatDate(lastBackup.created)   : "No backups yet",
                      },
                      {
                        label: "Total Saved",
                        value: `${backups.length} file${backups.length !== 1 ? "s" : ""}`,
                        sub:   "last 10 shown",
                      },
                      {
                        label: "Latest Size",
                        value: lastBackup ? formatBytes(lastBackup.size) : "—",
                        sub:   "uncompressed SQL",
                      },
                    ].map(({ label, value, sub }) => (
                      <div key={label} className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-gray-800">{value}</p>
                        <p className="text-[10px] text-gray-400 truncate">{sub}</p>
                      </div>
                    ))}
                  </div>

                  {/* Backup button */}
                  <button onClick={handleBackup} disabled={backupStatus === "running"}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-teal-500 text-white text-sm font-semibold shadow hover:from-blue-700 hover:to-teal-600 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  >
                    {backupStatus === "running"
                      ? <Loader2   size={16} className="animate-spin" />
                      : <Database  size={16} />}
                    {backupStatus === "running" ? "Creating Backup…" : "Create Backup Now"}
                  </button>

                  <p className="mt-2 text-xs text-gray-400 flex items-center gap-1 flex-wrap">
                    <Info size={11} />
                    Runs{" "}
                    <code className="bg-gray-100 px-1 rounded font-mono">pg_dump</code>
                    {" "}and saves a timestamped{" "}
                    <code className="bg-gray-100 px-1 rounded font-mono">.sql</code>
                    {" "}file to the server backup directory.
                  </p>
                </div>
              </div>

              {/* Backup history */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileArchive size={15} className="text-blue-600" />
                    <h2 className="font-semibold text-gray-800 text-sm">Backup History</h2>
                    {backups.length > 0 && (
                      <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {backups.length}
                      </span>
                    )}
                  </div>
                  <button onClick={loadBackups} disabled={loadingList}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    <RefreshCw size={13} className={loadingList ? "animate-spin" : ""} />
                    Refresh
                  </button>
                </div>

                {/* Loading */}
                {loadingList ? (
                  <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
                    <Loader2 size={18} className="animate-spin" />
                    Loading backup list…
                  </div>

                /* Empty */
                ) : backups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                    <Database size={40} strokeWidth={1} className="mb-3 opacity-30" />
                    <p className="text-sm font-semibold text-gray-500">No backups found</p>
                    <p className="text-xs mt-1">Click "Create Backup Now" to generate your first backup</p>
                  </div>

                /* Table */
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 font-semibold uppercase tracking-wide">
                          <th className="px-4 py-2.5 text-left w-8">#</th>
                          <th className="px-4 py-2.5 text-left">File Name</th>
                          <th className="px-4 py-2.5 text-left">Created</th>
                          <th className="px-4 py-2.5 text-right">Size</th>
                          <th className="px-4 py-2.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backups.map((b, i) => (
                          <tr key={b.name}
                            className={`border-b border-gray-50 last:border-0 hover:bg-blue-50/30 transition-colors ${
                              i === 0 ? "bg-green-50/40" : ""
                            }`}
                          >
                            {/* # */}
                            <td className="px-4 py-3 text-xs text-gray-400 font-medium">{i + 1}</td>

                            {/* File name */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileArchive size={14}
                                  className={i === 0 ? "text-green-500 shrink-0" : "text-gray-400 shrink-0"}
                                />
                                <span className="font-mono text-xs text-gray-700 truncate max-w-[220px]">
                                  {b.name}
                                </span>
                                {i === 0 && (
                                  <span className="shrink-0 text-[9px] bg-green-100 text-green-700 font-bold px-1.5 py-0.5 rounded uppercase">
                                    Latest
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Created */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Clock size={11} className="text-gray-400 shrink-0" />
                                {formatDate(b.created)}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5 pl-4">
                                {relativeTime(b.created)}
                              </p>
                            </td>

                            {/* Size */}
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1 text-xs text-gray-600">
                                <HardDrive size={11} className="text-gray-400" />
                                {formatBytes(b.size)}
                              </div>
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => handleDownload(b.name)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-medium transition-colors"
                                >
                                  <Download size={13} /> Download
                                </button>
                                <button onClick={() => handleDelete(b.name)}
                                  disabled={deletingFile === b.name}
                                  className="flex items-center gap-1 px-2 py-1.5 rounded-md bg-red-50 text-red-500 hover:bg-red-100 text-xs font-medium transition-colors disabled:opacity-50"
                                >
                                  {deletingFile === b.name
                                    ? <Loader2 size={13} className="animate-spin" />
                                    : <Trash2  size={13} />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Security note */}
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-5 py-4">
                <Shield size={16} className="shrink-0 mt-0.5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Security Reminder</p>
                  <p className="text-xs mt-0.5 text-amber-700">
                    Backup files contain all database data including user credentials.
                    Store downloaded backups securely and restrict access to the backup directory on the server.
                  </p>
                </div>
              </div>
            </>
          )}

          {/* ════════════════════════════════════════
              TAB: SYSTEM INFO
          ════════════════════════════════════════ */}
          {activeTab === "system" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3 flex items-center gap-2">
                <Server size={15} className="text-blue-600" />
                <h2 className="font-semibold text-gray-800 text-sm">System Information</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: "Application",      value: "Purchase Management System"           },
                  { label: "Backend",          value: "Express.js (Node.js)"                 },
                  { label: "Database",         value: "PostgreSQL 17"                        },
                  { label: "Backup API",       value: "POST  /api/backup"                   },
                  { label: "Backup Directory", value: "Configured via .env  (PostgresBackup)" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center px-5 py-3.5">
                    <span className="w-44 shrink-0 text-xs font-medium text-gray-400">{label}</span>
                    <code className="text-xs text-gray-700 bg-gray-50 px-2.5 py-1 rounded border border-gray-100 font-mono">
                      {value}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
