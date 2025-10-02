import React from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Policies from "./pages/Policies";
import Reports from "./pages/Reports";
import ClawDemo from "./pages/ClawDemo";
import Simulation from "./pages/Simulation";

export default function App() {
  return (
    <div className="app-shell">
      {/* SINGLE top bar with NASA logo (left) and the route tabs (right) */}
      <nav className="main-nav">
        <div className="nav-left">
          <span className="product">OrbitX</span>
        </div>

        <div className="nav-right">
          <NavLink end to="/" className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/simulation" className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            Simulation
          </NavLink>
          <NavLink to="/policies" className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            Policies
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => "tab" + (isActive ? " active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/claw" className="btn">Demo</NavLink>
        </div>
      </nav>

      {/* Route views (Dashboard has NO extra nav now) */}
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/simulation" element={<Simulation />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/claw" element={<ClawDemo />} />
      </Routes>
    </div>
  );
}
