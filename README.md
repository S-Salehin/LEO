# 🛰️ AstroLEO by Orbit_X

**Mission Control System for Low Earth Orbit Debris Management**

Our Live Link: https://leo-orbit-x-2025.vercel.app

[![NASA Space Apps Challenge](https://img.shields.io/badge/NASA-Space%20Apps%20Challenge-blue)](https://www.spaceappschallenge.org/)
[![Built with React](https://img.shields.io/badge/Built%20with-React-61DAFB)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Powered%20by-Three.js-black)](https://threejs.org/)

---

## 🌟 Overview

**AsteoLEO** is an advanced mission control dashboard for managing active debris removal operations in Low Earth Orbit. Built for the **NASA Space Apps Challenge 2025**, this system demonstrates a sustainable business model for commercializing LEO operations through debris removal, orbital recycling, and satellite life extension services.

### 🎯 Key Features

- **🌍 Real-time 3D Earth Visualization** - NASA GIBS satellite imagery with environmental data overlays
- **⚠️ Collision Detection System** - Predictive collision warnings with timing countdowns
- **🎨 Lifecycle Color Coding** - Visual satellite health indicators (Healthy/Aging/Critical)
- **🤖 Debris Collection Demo** - Animated robotic claw capture sequence
- **📊 AI-Powered Risk Analysis** - Machine learning models for collision risk assessment
- **📈 Mission Planning Tools** - Debris capture queue management and delta-v budgeting
- **☀️ Space Weather Integration** - Live DONKI Kp index for solar activity monitoring

---

## 🚀 Business Model

### Revenue Streams

1. **Active Debris Removal Services**
   - Governments and satellite operators pay for debris cleanup
   - Reduce collision risks and protect orbital infrastructure
   
2. **Orbital Recycling Economy**
   - Convert collected debris into 3D printing feedstock
   - In-space manufacturing of satellite components and station modules
   
3. **Satellite Life Extension**
   - On-orbit refueling and repair services
   - Repositioning and upgrade missions
   - Subscription-based maintenance plans

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI framework
- **Three.js** - 3D graphics and visualization
- **@react-three/fiber** - React renderer for Three.js
- **React Router** - Client-side routing
- **Vite** - Lightning-fast build tool

### Data Sources
- **NASA GIBS** - Global Imagery Browse Services for Earth visualization
- **NASA DONKI** - Space Weather Database for solar activity (Kp index)
- **TLE Data** - Two-Line Element sets for satellite tracking
- **satellite.js** - SGP4 orbit propagation library

### Key Libraries
- **Three.js r128** - 3D rendering engine
- **satellite.js 6.0** - Orbital mechanics calculations
- **MapLibre GL** - 2D mapping visualization

---

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd "Mission Green Card"

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application will be available at `http://localhost:5173`

---

## 🎮 Usage

### Dashboard
- **3D Globe**: Interact with the rotating Earth showing satellites and debris
  - **Blue dots**: Healthy satellites
  - **Yellow dots**: Aging satellites (half-life remaining)
  - **Red dots**: Critical satellites (near decay)
  - **Pink dots**: Debris objects
- **Hover** over objects to view orbital parameters
- **Click** to select and add to capture queue
- **Collision Warnings**: View upcoming collision events with countdown timers

### Simulation Suite
- **Earth View**: Visualize NASA GIBS environmental data
  - Toggle Atmospheric Rivers or El Niño impact overlays
  - Adjust date to view historical data
- **Debris Collection Demo**: Watch the robotic claw capture sequence
  - Autonomous approach and docking
  - Precision debris capture
  - Safe stowage in internal bay

### Policy Lab
- Adjust cleanup cadence and compliance parameters
- View AI-generated recommendations for debris removal priorities
- Analyze collision risk projections with Monte Carlo simulations
- Explore orbit clusters for multi-capture mission planning

### Reports
- Export mission data and risk assessments
- View top-10 highest-risk objects
- Generate PDF reports for stakeholders

---

## 🌐 NASA Data Integration

This project uses multiple NASA APIs and datasets:

1. **[NASA GIBS](https://gibs.earthdata.nasa.gov/)**
   - Real-time satellite imagery
   - Environmental data layers (Atmospheric Rivers, SST Anomalies)

2. **[NASA DONKI API](https://api.nasa.gov/)**
   - Space Weather Database
   - Kp index for geomagnetic activity

3. **[NASA Worldview](https://worldview.earthdata.nasa.gov/)**
   - Interactive 2D Earth visualization
   - Time-series environmental data

4. **[NASA EarthData](https://www.earthdata.nasa.gov/)**
   - Comprehensive Earth observation datasets

---

## 🧠 AI & Machine Learning

### Collision Risk Model
- **K-means clustering** for orbit grouping
- **Monte Carlo simulation** for long-term risk projection
- **Probabilistic risk scoring** based on:
  - Orbital altitude and inclination
  - Object density in orbital shells
  - Atmospheric drag effects
  - Historical debris population

### Features
- Predictive collision detection with timing
- Risk-based prioritization for debris removal
- Multi-factor analysis including space weather effects

---

## 📊 Project Structure

```
Mission Green Card/
├── public/
│   ├── tle/
│   │   └── custom.tle          # Satellite/debris TLE data
│   └── vendor/                 # External libraries (Three.js, satellite.js)
├── src/
│   ├── ai/
│   │   └── riskModel.js        # AI collision risk assessment
│   ├── components/
│   │   ├── Globe3D.jsx         # Main 3D Earth visualization
│   │   ├── CollisionWarnings.jsx  # Collision alert panel
│   │   ├── ClawDemo.jsx        # Debris capture animation
│   │   └── ...
│   ├── pages/
│   │   ├── Dashboard.jsx       # Mission control dashboard
│   │   ├── Simulation.jsx      # Earth & claw demo suite
│   │   ├── Policies.jsx        # AI policy lab
│   │   └── Reports.jsx         # Analytics & reporting
│   ├── utils/
│   │   ├── collisionDetect.js  # Collision detection algorithms
│   │   ├── scoring.js          # Risk scoring utilities
│   │   └── sim.js              # Simulation helpers
│   ├── store/
│   │   └── appState.jsx        # Global state management
│   ├── App.jsx                 # Root component
│   ├── main.jsx                # Entry point
│   └── styles.css              # Futuristic UI theme
└── package.json
```

---

## 🎨 Design Philosophy

### Futuristic Space UI
- **Deep space color palette** - Dark backgrounds with cyan/blue accents
- **Glowing effects** - Subtle box-shadows and borders for depth
- **Responsive animations** - Smooth transitions and hover effects
- **Professional typography** - Clear hierarchy and readability
- **Mission control aesthetic** - Inspired by NASA and SpaceX control rooms

### User Experience
- **Intuitive navigation** - Clear routing and breadcrumbs
- **Real-time feedback** - Live collision warnings and status updates
- **Accessible controls** - Sliders, buttons, and inputs optimized for usability
- **Informative tooltips** - Context-aware hints and explanations

---

## 🚧 Future Enhancements

- [ ] WebGL shader effects for realistic atmospheric scattering
- [ ] Multi-satellite trajectory optimization
- [ ] Real-time telemetry from actual satellite APIs
- [ ] VR/AR mission planning interface
- [ ] Integration with Unity WebGL builds for advanced simulations
- [ ] Blockchain-based debris removal credits marketplace
- [ ] IoT sensor data from space-based debris sensors

---

## 👥 Team

**Mission Green Card**
- Built for NASA Space Apps Challenge 2025
- Focus: Commercializing Low Earth Orbit through sustainable debris management

---

## 📄 License

This project uses NASA's open data and APIs in accordance with their [Data and Information Policy](https://www.nasa.gov/about/highlights/HP_Privacy.html).

---

## 🙏 Acknowledgments

- **NASA** for providing open APIs and data
- **Space Apps Challenge** organizers and mentors
- **Three.js** and **satellite.js** communities
- All contributors to open-source space technology

---

## 📞 Contact

For questions, feedback, or collaboration opportunities, please reach out through the NASA Space Apps Challenge platform.

---

**🌌 Making space sustainable, one debris at a time.**
