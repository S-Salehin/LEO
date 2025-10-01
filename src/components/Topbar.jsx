// src/components/Topbar.jsx
import React from "react";
import { NavLink } from "react-router-dom";

export default function Topbar() {
  return (
    <header className="topbar">
      <div className="brand-left">
        <img
          src="/nasa.png"
          alt="NASA"
          width="22"
          height="22"
          style={{ marginRight: 8 }}
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <span className="app-title"><strong>LEO Steward OS</strong></span>
      </div>

      {/* RIGHT NAV — add Demo here */}
      <nav className="nav-right">
        <NavLink to="/" end className="btn">Dashboard</NavLink>
        <NavLink to="/simulation" className="btn">Simulation</NavLink>
        <NavLink to="/policies" className="btn">Policies</NavLink>
        <NavLink to="/reports" className="btn">Reports</NavLink>
        <NavLink to="/claw" className="btn">Demo</NavLink>
      </nav>
    </header>
  );
}
