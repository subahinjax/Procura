"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Power } from "lucide-react";
import { useRouter } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { USER_TYPES } from "@/lib/accessControl";
import { hasAccess } from "@/lib/accessControl";
import React from "react";
import { useAuth } from "@/context/AuthContext";
import { FiHome, FiUser, FiSettings } from "react-icons/fi";

interface SidebarLayoutProps {
  title: string;
  children: React.ReactNode;
  menuItems?: { label: string; href: string }[];
  activeSection?: string | null;
  setActiveSection?: (section: string | null) => void;
  dirty?: boolean;
}

export default function SidebarLayout({
  title,
  children,
  menuItems = [],
  activeSection,
  setActiveSection,
  dirty = false,
}: SidebarLayoutProps) {
  const router = useRouter();
  const [isSidebarVisible, setSidebarVisible] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const masterRef = useRef<HTMLDivElement>(null);
  const transactionRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const { user, loading } = useAuth();
  const userType = user?.user_type ?? null;

  const toggleDropdown = (menu: string) => {
    setOpenDropdown(openDropdown === menu ? null : menu);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        masterRef.current && !masterRef.current.contains(event.target as Node) &&
        transactionRef.current && !transactionRef.current.contains(event.target as Node) &&
        reportRef.current && !reportRef.current.contains(event.target as Node)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const confirmAndNavigate = (href: string, label: string) => {
    if (dirty) {
      const confirmLeave = window.confirm("You have unsaved changes. Do you really want to leave?");
      if (!confirmLeave) return;
    }
    if (setActiveSection) setActiveSection(label);
    router.push(href);
  };

  if (loading) return null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-gradient-to-r from-purple-600 to-blue-500 text-black px-4 py-1 flex justify-between items-centre shadow print:hidden">
<div className="flex items-center gap-4 print:hidden">
  <button onClick={() => setSidebarVisible(!isSidebarVisible)} className="text-white font-bold">☰</button>
  <a href="/" title="Dashboard" className="text-white hover:opacity-80"><FiHome size={24} /></a>
  <a href="/profile" title="Profile" className="text-white hover:opacity-80"><FiUser size={24} /></a>

{hasAccess(userType, "USER_MASTER") && (
  <a href="/settings" title="Settings" className="text-white hover:opacity-80"><FiSettings size={24} /></a>
)}

<h1 className="font-bold text-xl tracking-wide text-white">
  <span className="text-white">
    Procura Soft
   </span>
</h1>


</div>

        <nav className="flex items-center gap-5 relative">

          {/* Master Dropdown — MASTER_MENU users only */}
          {hasAccess(userType, "MASTER_MENU") && (
            <div className="inline-block relative" ref={masterRef}>
              <button
                onClick={() => toggleDropdown("master")}
                className="px-4 py-1 rounded-lg bg-gradient-to-r from-blue-300 to-white text-black font-medium hover:opacity-80"
              >
                Master
              </button>
              {openDropdown === "master" && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-50">
                  <button onClick={() => window.open("/suppliers/create", "_blank")}
                    className="w-full text-left px-2 py-2 hover:bg-gray-100">
                    Supplier
                  </button>
                  <button onClick={() => window.open("/items/create", "_blank")}
                    className="w-full text-left px-2 py-2 hover:bg-gray-100">
                    Items
                  </button>
                  <button onClick={() => window.open("/terms_cond/create", "_blank")}
                    className="w-full text-left px-2 py-2 hover:bg-gray-100">
                    Terms & Conditions
                  </button>
                  {/* ✅ User — ADMIN only */}
                  {hasAccess(userType, "USER_MASTER") && (
                    <button onClick={() => window.open("/users/create", "_blank")}
                      className="w-full text-left px-2 py-2 hover:bg-gray-100">
                      User
                    </button>
                  )}

	          {/* ✅ Department */}

	        <button
        	  onClick={() => window.open("/master/department", "_blank")}
	          className="w-full text-left px-2 py-2 hover:bg-gray-100"
        	>
	          Department
        	</button>
 

	          {/* ✅ Category */}
                {hasAccess(userType, "USER_MASTER") && (
	        <button
        	  onClick={() => window.open("/master/category", "_blank")}
	          className="w-full text-left px-2 py-2 hover:bg-gray-100"
        	>
	          Category
        	</button>
                )}

	          {/* ✅ Category */}

	        <button
        	  onClick={() => window.open("/master/cs-approver", "_blank")}
	          className="w-full text-left px-2 py-2 hover:bg-gray-100"
        	>
	          CS Verifier & Approver
        	</button>




                </div>
              )}
            </div>
          )}

          {/* Transaction Dropdown */}
          <div className="inline-block relative" ref={transactionRef}>
            <button onClick={() => toggleDropdown("transaction")}
              className="px-1 py-1 rounded-lg bg-gradient-to-r from-blue-300 to-white text-black font-medium hover:opacity-80">
              Transaction
            </button>
            {openDropdown === "transaction" && (
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-lg z-50">
                <button onClick={() => { setOpenDropdown(null); router.push("/purchase/create"); }}
                  className="w-full text-left px-2 py-2 hover:bg-gray-100">
                  Purchase Order
                </button>

{hasAccess(userType, "STORES_GRN") && (
<button onClick={() => { setOpenDropdown(null); router.push("/stores/grn"); }}
  className="w-full text-left px-2 py-2 hover:bg-gray-100">
  Stores
</button>
 )}



                {/* ✅ Accounts — only visible to ACCOUNTS_PAY users */}
                {hasAccess(userType, "ACCOUNTS_PAY") && (
                  <button onClick={() => { setOpenDropdown(null); router.push("/po_accounts"); }}
                    className="w-full text-left px-2 py-2 hover:bg-gray-100">
                    Accounts
                  </button>
                )}
              </div>
            )}
          </div>


          {/* Report Dropdown */}
          <div className="inline-block relative" ref={reportRef}>
{!hasAccess(userType, "GENERAL_ALL") && (

            <button onClick={() => toggleDropdown("report")}
              className="px-4 py-1 rounded-lg bg-gradient-to-r from-blue-300 to-white text-black gap-6 font-medium hover:opacity-80">
              Report
            </button>
)}

            {openDropdown === "report" && (
              <div className="absolute left-0 mt-2 w-40 bg-white rounded-xl shadow-lg z-50">
                <button onClick={() => { setOpenDropdown(null); router.push("/reports/po"); }}
                  className="w-full text-left px-2 py-2 hover:bg-gray-100">
                  PO Report
                </button>
              </div>
            )}
          </div>


          {/* Logout */}
          <div className="ml-24">
            <div className="px-1 py-1 rounded-lg hover:bg-red-100 transition">
              <LogoutButton />
            </div>
          </div>
        </nav>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1">
        <aside className={`bg-gray-100 border-r shadow-md flex flex-col transition-all duration-300 ${
          isSidebarVisible ? "w-64" : "w-4"} print:hidden`}>
          {isSidebarVisible ? (
            <>
              <div className="p-4 border-b text-blue-700 font-bold flex justify-between items-center">
                <span>📁 {title}</span>
                <button onClick={() => setSidebarVisible(false)}
                  className="text-gray-700 hover:text-gray-900 text-2xl font-extrabold">«</button>
              </div>
              <ul className="p-4 space-y-2 text-sm text-gray-800 flex-1 overflow-y-auto">
                {menuItems.map((item, index) => (
                  <li key={index}>
                    <button onClick={() => confirmAndNavigate(item.href, item.label)}
                      className={`block w-full text-left px-2 py-1 rounded hover:bg-blue-50 ${
                        activeSection === item.label ? "bg-blue-100 font-semibold" : ""}`}>
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <button onClick={() => setSidebarVisible(true)}
                className="text-gray-700 hover:text-gray-900 text-2xl font-extrabold">»</button>
            </div>
          )}
        </aside>
        <main className="flex-1 p-2 bg-white overflow-y-auto print:w-full print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
