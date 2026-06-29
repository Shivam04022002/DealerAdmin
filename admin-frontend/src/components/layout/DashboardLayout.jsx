import React from "react";
import Navbar from "../Navbar";

export default function DashboardLayout({ children }) {
  return (
    <div
      className="dashboard-container"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#eef2ff 0%, #f8fafc 40%, #ffffff 100%)",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <Navbar />
      <div
        style={{
          flex: 1,
          padding: "22px",
          display: "flex",
          gap: "18px",
          height: "calc(100vh - 65px)", // adjust based on Navbar height
          overflow: "hidden"
        }}
      >
        {children}
      </div>
    </div>
  );
}
