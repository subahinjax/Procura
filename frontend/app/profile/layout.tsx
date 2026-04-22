"use client";

import SidebarLayout from "@/components/SidebarLayout";

export default function SupplierLayout({ children }: { children: React.ReactNode }) {
  const menuItems = [
    { label: "Profile", href: "/profile" },
  ];

  return (
    <SidebarLayout title="Profile" menuItems={menuItems}>
      {children}
    </SidebarLayout>
  );
}
