<p align="center">
  <a href="./README.en.md">English</a> | <span>简体中文</span>
</p>

<div align="center">

# 🐠 涟漪鱼缸

**纯前端 WebGL 水族箱 · boids 鱼群 + 实时水面涟漪**

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
  👉 <a href="https://seanwong17.github.io/RippleAquarium/">点击查看在线演示 (Live Demo)</a> 👈
</h3>

<p style="font-size: 13px; color: #666;">
  注：在线演示会直接加载默认鱼缸场景，支持鼠标点击/拖动水面触发涟漪。
</p>

<img src="assets/demo.gif" alt="涟漪鱼缸演示" width="80%">

</div>

---

## 📋 项目简介

**涟漪鱼缸** 是一个在浏览器里实时运行的 3D 水族箱，无需安装，打开网页就能玩。

整缸鱼用 boids 群体行为自主游动，会聚集、转向、互相避让；鱼游近水面或你点击、拖动水面，都会荡开真实传播的水波；珊瑚则在页面打开时从无到有、慢慢生长成形。所有效果都在 WebGL 里逐帧实时计算，构成一个会自我运转的小世界，而不是一段预录动画。

---

## ✨ 核心特性

| 模块 | 功能描述 |
|------|----------|
| **鱼群** | 沙丁鱼与锦鲤独立集群活动，使用一致的 boids 行为逻辑，支持数量、速度和行为参数调节 |
| **小丑鱼** | 底栖活动模式，只在珊瑚附近和珊瑚上方小范围水域巡游，并避开珊瑚 |
| **水面** | 高度场水面模拟，鱼靠近水线、鼠标点击和鼠标拖动都可以触发涟漪 |
| **珊瑚** | 页面打开或刷新时从 0 个、0 尺寸逐步生长到默认状态，营造生命感 |
| **控制面板** | 右侧可折叠菜单，提供鱼群、水面、珊瑚、光照和显示效果等中文参数 |
| **多语言** | 可视化界面和 README 支持中文/英文切换 |
| **部署** | 静态前端项目，可直接部署到 GitHub Pages |

---

## 🚀 快速开始

这是一个静态 Three.js ESM 项目，不依赖后端服务。Three.js 运行时已本地化到 `vendor/`，本地服务器运行时无需联网。

> 提示：由于使用了原生 ES Module，浏览器在 `file://` 协议下会拦截模块加载，因此需要通过本地 HTTP 服务器打开，不能直接双击 `index.html`。

### 1. 获取项目

```bash
git clone https://github.com/SeanWong17/RippleAquarium.git
cd RippleAquarium
```

### 2. 本地运行

建议使用本地静态服务器运行：

```bash
python3 -m http.server 8001
```

然后打开：

```text
http://127.0.0.1:8001/index.html
```

### 3. 运行测试（可选）

模拟逻辑（boids 转向、避障射线、空间网格）带有单元测试，使用 Node 内置 test runner，无第三方依赖：

```bash
npm test
```

---

## 🎮 交互方式

| 操作 | 效果 |
|------|------|
| 鼠标点击水面 | 产生一次涟漪 |
| 鼠标按住并拖动水面 | 沿拖动路径产生连续涟漪 |
| 右侧按钮 | 隐藏或显示参数面板 |
| 左上角语言按钮 | 在中文和英文界面之间切换 |
| 左上角 GitHub 图标 | 跳转到项目仓库 |
| 空格键 | 在外部环绕相机和鱼视角相机之间切换 |
| `1` / `2` | 显示或隐藏界面面板 |

---

## 🛠️ 技术实现

| 模块 | 实现要点 |
|------|----------|
| **渲染** | Three.js + WebGL，使用实例化渲染绘制主鱼群 |
| **鱼群行为** | boids 对齐、聚集、分离、避障、边界回避与独立鱼群参数 |
| **性能** | 使用均匀空间网格做邻居查询，将鱼群行为从 O(n²) 降到近 O(n)，热路径复用对象避免每帧分配 |
| **鱼体运动** | 基于速度方向和姿态变化驱动鱼体朝向，锦鲤复用沙丁鱼行为逻辑并保留更粗胖的体型 |
| **水面涟漪** | 使用水面网格高度场传播波动，支持鼠标与鱼体触发 |
| **珊瑚生长** | 初始化阶段按统一成长进度驱动每个珊瑚从小到大生长 |
| **依赖** | Three.js 运行时与 addons 本地化到 `vendor/`，本地服务器运行时无需联网 |
| **国际化** | 轻量级前端 i18n 字典，界面文案可在中英文之间切换 |

### 项目结构

```text
RippleAquarium/
├── assets/                 # README 演示动图
├── vendor/three/           # 本地化的 Three.js 运行时与 addons
├── src/
│   ├── fish/               # 鱼模型加载、姿态、变形、实例化渲染与空间网格
│   ├── coral/              # 珊瑚模型资源
│   ├── fish-school-simulation.js
│   ├── water-surface.js
│   ├── coral-reef.js
│   ├── clownfish-school.js
│   ├── i18n.js
│   └── main.js
├── test/                   # 模拟逻辑单元测试（Node 内置 test runner）
├── index.html
├── package.json
├── README.md
├── README.en.md
└── LICENSE
```

---

## 🙏 项目来源与参考

本项目是在以下开源/公开项目和模型资源基础上整合、改造和再设计得到的：

| 项目 | 借鉴内容 |
|------|----------|
| [vibe-motion/threejs-boids](https://github.com/vibe-motion/threejs-boids) | 当前项目的鱼群行为基础，提供沙丁鱼式 boids 运动、Three.js 场景和实例化鱼群渲染的起点 |
| [aisparkedu/ripple](https://github.com/aisparkedu/ripple) | 参考水面涟漪交互思路，并改造成当前鱼缸中的鼠标/鱼体触发水波效果 |
| [Jaydeep-P/aquarium](https://github.com/Jaydeep-P/aquarium) | 参考水族箱题材资源，借鉴珊瑚、小丑鱼和锦鲤等视觉元素方向；当前项目中珊瑚和小丑鱼模型资源来自该项目 |
| [Bfbbr-SpongeBob Pineapple House](https://sketchfab.com/3d-models/bfbbr-spongebob-pineapple-house-4e2d36c5f95645448b44af409432ae82) | 鱼缸底部菠萝屋装饰模型，作者 SMF Features Developed From Cheryl Hill，Sketchfab 标注为 CC Attribution |
| [NASB2 - SpongeBob and Patrick](https://sketchfab.com/3d-models/nasb2-spongebob-and-patrick-717a58577d554b86802162db847c7f13) | 鱼缸底部角色装饰模型，作者 SMF Features Developed From Cheryl Hill，Sketchfab 标注为 CC Attribution |

如果你继续分发或部署本项目，请保留这些来源说明，并检查上游项目的许可证要求。

---

## 🤝 贡献与反馈

欢迎提交 Issue 或 Pull Request。

* **Issues**: [Bug 反馈与功能建议](https://github.com/SeanWong17/RippleAquarium/issues)
* **Pull Requests**: [提交改进](https://github.com/SeanWong17/RippleAquarium/pulls)

---

## 📄 License

本项目使用 [GNU Affero General Public License v3.0](./LICENSE)。

---

<div align="center">
  <br>
  Made with ❤️ by <a href="https://github.com/seanwong17">seanwong17</a>
</div>
