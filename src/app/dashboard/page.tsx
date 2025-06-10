"use client";

import AdminDashboard  from "./admin/AdminDashboard";
import UserDashboard  from "./user/UserDashboard";
import { useAuth } from "../../context/AuthProvider";
import { getUserRole } from "@/lib/auth";
import { useEffect, useState } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);

  // Get the user role
  useEffect(() => {
    if (user) {
      getUserRole(user, setRole);
    }
  }, [user]);

  // If the user is an admin, return the admin dashboard, otherwise return the user dashboard
  if (role === "admin") {
    return <AdminDashboard />;
  } else if (role === "user") {
    return <UserDashboard />;
  }
}