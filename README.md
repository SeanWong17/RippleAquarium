# 涟漪鱼缸

[English](./README.en.md)

涟漪鱼缸是一个基于 Three.js 的交互式水族箱可视化项目。它把独立鱼群行为、水面涟漪、珊瑚生长动画和可调参数面板组合在一起，用来展示一个更有生命感的浏览器端 3D 鱼缸。

在线演示：[https://seanwong17.github.io/RippleAquarium/](https://seanwong17.github.io/RippleAquarium/)

![涟漪鱼缸演示](./assets/demo.gif)

## 功能

- 沙丁鱼鱼群使用 boids 行为模拟，会自动对齐、聚集、分离、避障和回避边界。
- 锦鲤作为独立鱼群活动，行为逻辑与沙丁鱼一致，但有独立数量、速度和行为参数。
- 小丑鱼作为底栖鱼类，只在珊瑚附近和上方小范围水域巡游。
- 水面使用高度场模拟，鱼靠近水线、鼠标点击或拖动水面都会产生涟漪。
- 珊瑚会在页面打开或刷新时从 0 个、0 尺寸逐步生长到默认状态。
- 右侧参数面板支持折叠，并提供鱼群、水面、珊瑚、光照等中文控制项。
- 可视化界面支持中文/英文切换，左上角提供 GitHub 仓库入口。
- 默认相机视角已调整为更接近鱼缸，适合直接展示。

## 运行

这是一个静态 Three.js ESM 项目，可以直接用本地静态服务器运行：

```bash
python3 -m http.server 8001
```

然后打开：

```text
http://127.0.0.1:8001/index.html
```

## 控制

- 鼠标点击水面：产生一次涟漪。
- 鼠标按住并拖动水面：沿拖动路径产生连续涟漪。
- 右侧按钮：隐藏或显示参数面板。
- 空格键：在外部环绕相机和鱼视角相机之间切换。
- `1` / `2`：显示或隐藏界面面板。

## 项目来源与参考

本项目是在以下三个开源/公开项目基础上整合、改造和再设计得到的：

- [vibe-motion/threejs-boids](https://github.com/vibe-motion/threejs-boids)：作为当前项目的鱼群行为基础，提供沙丁鱼式 boids 运动、Three.js 场景和实例化鱼群渲染的起点。
- [aisparkedu/ripple](https://github.com/aisparkedu/ripple)：参考其水面涟漪交互思路，并改造成当前鱼缸中的鼠标/鱼体触发水波效果。
- [Jaydeep-P/aquarium](https://github.com/Jaydeep-P/aquarium)：参考其水族箱题材资源，借鉴珊瑚、小丑鱼和锦鲤等视觉元素方向；当前项目中珊瑚和小丑鱼模型资源来自该项目，锦鲤最终改为基于沙丁鱼运动模型派生的程序化体型和花纹。

如果你继续分发或部署本项目，请同时保留这些来源说明，并检查上游项目的许可证要求。

## 许可证

本项目使用 [GNU Affero General Public License v3.0](./LICENSE)。
