"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* ================= TYPES ================= */
type User = {
  id: string;
  username: string;
  email: string;
  user_type: string;
  active: boolean;
  dept_id: string; // ✅ added
};

type Department = {
  dept_id: string;
  dept_name: string;
};

interface FieldProps {
  label: string;
  value: string;
  readOnly: boolean;
  onChange: (value: string) => void;
}

/* ================= INPUT FIELD ================= */
function InputField({ label, value, readOnly, onChange }: FieldProps) {
  return (
    <div className="mb-3">
      <label className="block text-gray-700 font-medium mb-1 px-2">{label}</label>
      <input
        type="text"
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border border-gray-300 rounded-lg h-[40px] px-2 ${
          readOnly ? "bg-gray-100" : "bg-white"
        }`}
      />
    </div>
  );
}

/* ================= PAGE ================= */
export default function UserMaster() {
  const emptyUser: User = {
    id: "",
    username: "",
    email: "",
    user_type: "",
    active: true,
    dept_id: "", // ✅ added
  };

  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]); // ✅ added
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<User>(emptyUser);
  const [mode, setMode] = useState<"view" | "add" | "edit">("view");
  const [search, setSearch] = useState("");

  /* ================= FETCH ON MOUNT ================= */
  useEffect(() => {
    fetchUsers();
    fetchDepartments(); // ✅ added
  }, []);

  /* ================= FETCH USERS ================= */
  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/users?all=true", {
         cache: "no-store",
       });

      if (res.status === 401 || res.status === 403) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((u) => ({ ...u, id: String(u.id), dept_id: u.dept_id ?? "" }))
        : [];
      setUsers(normalized);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    }
  };

  /* ================= FETCH DEPARTMENTS ================= */
  // ✅ New function — calls /api/departments which queries mas_Dept
const fetchDepartments = async () => {
  try {
    const res = await fetch("/api/department"); // ✅ matches server.js & route.ts
    if (!res.ok) throw new Error("Failed to fetch departments");
    const data = await res.json();
    setDepartments(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Failed to fetch departments:", err);
  }
};

  /* ================= SELECT ================= */
  const handleSelect = (userId: string) => {
    if (!userId) {
      setSelectedUser(null);
      setUserData(emptyUser);
      setMode("view");
      return;
    }

    const user = users.find((u) => String(u.id) === userId);
    if (!user) return;

    setSelectedUser(user);
    setUserData({
      id: user.id,
      username: user.username,
      email: user.email,
      user_type: user.user_type,
      active: user.active,
      dept_id: user.dept_id ?? "", // ✅ added
    });
    setMode("view");
  };

  /* ================= ADD ================= */
  const handleAdd = () => {
    setUserData(emptyUser);
    setSelectedUser(null);
    setMode("add");
  };

  /* ================= EDIT ================= */
  const handleEdit = () => {
    if (!selectedUser) return;
    setMode("edit");
  };

  /* ================= DUPLICATE CHECK ================= */
  const isDuplicate = () => {
    return users.some(
      (u) =>
        u.id !== userData.id &&
        (u.username.toLowerCase() === userData.username.toLowerCase() ||
          u.email.toLowerCase() === userData.email.toLowerCase())
    );
  };

  /* ================= SAVE ================= */
  const handleSave = async () => {
    if (!userData.username || !userData.email || !userData.user_type || !userData.dept_id) {
      alert("All fields are required ❌"); // ✅ dept_id now validated
      return;
    }

    if (isDuplicate()) {
      alert("Username or Email already exists ❌");
      return;
    }

    const res = await fetch("/api/users", {
      method: mode === "add" ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData), // ✅ dept_id included automatically
    });

    if (res.status === 401) { router.replace("/session-expired"); return; }
    if (res.status === 403) { alert("Access Denied ❌"); return; }
    if (!res.ok) { alert("Failed to save user ❌"); return; }

    await fetchUsers();
    setMode("view");
    setUserData(emptyUser);
    setSelectedUser(null);
    alert("User saved successfully ✅");
  };

  /* ================= CANCEL ================= */
  const handleCancel = () => {
    setUserData(emptyUser);
    setSelectedUser(null);
    setMode("view");
  };

  const filteredUsers = search
    ? users.filter((u) =>
        u.username.toLowerCase().includes(search.toLowerCase())
      )
    : users;

  /* ================= UI ================= */
  return (
    <div className="flex justify-center mt-8">
      <div className="w-full max-w-2xl bg-white shadow-lg rounded-2xl px-2 border border-gray-200">
        <h2 className="text-xl font-semibold mb-3 border-b pb-0 mt-3 px-2">
          User Master
        </h2>

        {/* SEARCH */}
        <div className="mb-1">
          <input
            type="text"
            placeholder="Search username"
            disabled={mode !== "view"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* SELECT USER */}
        <div className="mb-4">
          <label className="block text-gray-700 font-medium mt-3 mb-1 px-2">
            Select User
          </label>
          <select
            disabled={mode !== "view"}
            value={selectedUser?.id ?? ""}
            onChange={(e) => handleSelect(e.target.value)}
            className={`w-full border border-gray-300 rounded-lg p-2 ${
              mode !== "view" ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          >
            <option value="">-- Select User --</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.username}
              </option>
            ))}
          </select>
        </div>

        {/* FIELDS */}
        <InputField
          label="Username"
          value={userData.username}
          readOnly={mode === "view"}
          onChange={(v) => setUserData({ ...userData, username: v })}
        />

        <InputField
          label="Email"
          value={userData.email}
          readOnly={mode === "view"}
          onChange={(v) => setUserData({ ...userData, email: v })}
        />

        {/* DEPARTMENT ✅ New dropdown populated from mas_Dept */}
        <div className="mb-3">
          <label className="block text-gray-700 font-medium mb-1 px-2">
            Department
          </label>
          <select
            disabled={mode === "view"}
            value={userData.dept_id}
            onChange={(e) =>
              setUserData({ ...userData, dept_id: e.target.value })
            }
            className={`w-full border border-gray-300 rounded-lg p-2 ${
              mode === "view" ? "bg-gray-100" : "bg-white"
            }`}
          >
            <option value="">-- Select Department --</option>
            {departments.map((d) => (
              <option key={d.dept_id} value={d.dept_id}>
                {d.dept_name}
              </option>
            ))}
          </select>
        </div>

        {/* USER TYPE */}
        <div className="mb-3">
          <label className="block text-gray-700 font-medium mb-1 px-2">
            User Type
          </label>
          <select
            disabled={mode === "view"}
            value={userData.user_type}
            onChange={(e) =>
              setUserData({ ...userData, user_type: e.target.value })
            }
            className={`w-full border border-gray-300 rounded-lg p-2 ${
              mode === "view" ? "bg-gray-100" : "bg-white"
            }`}
          >
            <option value="">-- Select User Type --</option>
            <option value="ADMIN">ADMIN</option>
            <option value="GENERAL">GENERAL</option>
            <option value="PURCHASE">PURCHASE</option>
            <option value="ACCOUNTS">ACCOUNTS</option>
            <option value="STORES">STORES</option>
            <option value="HOD">HOD</option>
            <option value="APPROVER">APPROVER</option>
          </select>
        </div>

        {/* ACTIVE */}
        <div className="mb-3">
          <label className="block text-gray-700 font-medium mb-1 px-2">
            Active
          </label>
          <select
            disabled={mode === "view"}
            value={userData.active ? "true" : "false"}
            onChange={(e) =>
              setUserData({
                ...userData,
                active: e.target.value === "true",
              })
            }
            className={`w-full border border-gray-300 rounded-lg p-2 ${
              mode === "view" ? "bg-gray-100" : "bg-white"
            }`}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        {/* BUTTONS */}
        <div className="flex gap-4 mt-6">
          {mode === "view" && (
            <>
              <button
                onClick={handleAdd}
                className="bg-blue-500 text-white px-8 py-2 rounded-lg hover:bg-blue-600"
              >
                Add
              </button>
              <button
                onClick={handleEdit}
                disabled={!selectedUser}
                className="bg-green-500 text-white px-8 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                Edit
              </button>
            </>
          )}

          {(mode === "add" || mode === "edit") && (
            <>
              <button
                onClick={handleSave}
                className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"
              >
                Save
              </button>
              <button
                onClick={handleCancel}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}