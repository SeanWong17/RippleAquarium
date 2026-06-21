<p align="center">
  <span>English</span> | <a href="./README.md">简体中文</a>
</p>

<div align="center">

# 🐠 Ripple Aquarium

**Interactive Three.js aquarium with boids, water ripples, and coral growth**

<p>
  <a href="https://www.gnu.org/licenses/agpl-3.0.html">
    <img src="https://img.shields.io/badge/License-AGPL--3.0-blue.svg?style=flat-square" alt="License">
  </a>
  <a href="https://threejs.org/">
    <img src="https://img.shields.io/badge/Three.js-WebGL-black?style=flat-square&logo=three.js" alt="Made with Three.js">
  </a>
  <a href="https://github.com/SeanWong17/RippleAquarium/pulls">
    <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square" alt="PRs Welcome">
  </a>
  <a href="https://seanwong17.github.io/RippleAquarium/">
    <img src="https://img.shields.io/badge/Demo-GitHub%20Pages-2ea44f?style=flat-square&logo=github" alt="Live Demo">
  </a>
</p>

<h3>
  👉 <a href="https://seanwong17.github.io/RippleAquarium/">Open the Live Demo</a> 👈
</h3>

<p style="font-size: 13px; color: #666;">
  The demo loads the default aquarium scene. Click or drag on the water surface to create ripples.
</p>

<img src="assets/demo.gif" alt="Ripple Aquarium demo" width="80%">

</div>

---

## 📋 Introduction

**Ripple Aquarium** is an interactive browser-based 3D aquarium built with Three.js.

It combines boids-style fish movement, height-field water ripples, coral growth animation, multiple fish appearances, and a collapsible tuning panel. When the page opens or refreshes, the coral reef grows from zero; fish swim continuously inside the tank; and both fish near the surface and mouse interactions can trigger visible ripples.

---

## ✨ Core Features

| Module | Description |
|--------|-------------|
| **Fish schools** | Sardines and koi move as independent schools using the same boids behavior, with separate count, speed, and behavior controls |
| **Clownfish** | Bottom-dwelling movement around the reef and the small water region above it, with coral avoidance |
| **Water surface** | Height-field water simulation triggered by mouse clicks, mouse drags, and fish near the waterline |
| **Coral reef** | On page load or refresh, corals grow from zero count and zero scale into the default reef |
| **Control drawer** | Collapsible right-side panel for fish, water, coral, lighting, and visual parameters |
| **Internationalization** | The UI and README support Chinese and English |
| **Deployment** | Static frontend project deployable on GitHub Pages |

---

## 🚀 Quick Start

This is a static Three.js ESM project with no backend dependency.

### 1. Get the project

```bash
git clone https://github.com/SeanWong17/RippleAquarium.git
cd RippleAquarium
```

### 2. Run locally

Use a local static server:

```bash
python3 -m http.server 8001
```

Then open:

```text
http://127.0.0.1:8001/index.html
```

---

## 🎮 Controls

| Action | Result |
|--------|--------|
| Click the water surface | Create one ripple |
| Hold and drag on the water surface | Create continuous ripples along the drag path |
| Right-side button | Hide or show the control drawer |
| Top-left language buttons | Switch between Chinese and English |
| Top-left GitHub icon | Open the repository |
| Space | Switch between the orbit camera and fish camera |
| `1` / `2` | Show or hide UI panels |

---

## 🛠️ Technical Notes

| Module | Implementation |
|--------|----------------|
| **Rendering** | Three.js + WebGL, with instanced rendering for the main fish schools |
| **Boids** | Alignment, cohesion, separation, obstacle avoidance, boundary steering, and independent school parameters |
| **Fish motion** | Fish orientation follows velocity and pose changes; koi reuse sardine behavior while keeping a thicker body shape |
| **Ripples** | Water mesh height-field propagation with mouse-triggered and fish-triggered disturbance |
| **Coral growth** | The initialization sequence drives each coral from small to full size |
| **i18n** | Lightweight frontend dictionary for Chinese/English UI text |

### Project Structure

```text
RippleAquarium/
├── assets/                 # README demo GIF
├── src/
│   ├── fish/               # Fish model loading, pose, deformation, and instanced rendering
│   ├── coral/              # Coral model assets
│   ├── fish-school-simulation.js
│   ├── water-surface.js
│   ├── coral-reef.js
│   ├── clownfish-school.js
│   ├── i18n.js
│   └── main.js
├── index.html
├── README.md
├── README.en.md
└── LICENSE
```

---

## 🙏 Credits And References

This project integrates, adapts, and redesigns ideas from three public/open-source projects:

| Project | Reference |
|---------|-----------|
| [vibe-motion/threejs-boids](https://github.com/vibe-motion/threejs-boids) | Base fish-school behavior, sardine-style boids movement, Three.js scene, and instanced fish rendering |
| [aisparkedu/ripple](https://github.com/aisparkedu/ripple) | Interactive water-ripple behavior, adapted here into mouse-triggered and fish-triggered aquarium surface waves |
| [Jaydeep-P/aquarium](https://github.com/Jaydeep-P/aquarium) | Aquarium visual direction, coral, clownfish, and koi references; coral and clownfish model assets in this project come from that project |

If you redistribute or deploy this project, keep these credits and review the license requirements of the upstream projects as well.

---

## 🤝 Contribution

Issues and Pull Requests are welcome.

* **Issues**: [Bug reports and feature requests](https://github.com/SeanWong17/RippleAquarium/issues)
* **Pull Requests**: [Submit improvements](https://github.com/SeanWong17/RippleAquarium/pulls)

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE).

---

<div align="center">
  <br>
  Made with ❤️ by <a href="https://github.com/seanwong17">seanwong17</a>
</div>
