# Ripple Aquarium

[中文](./README.md)

Ripple Aquarium is an interactive Three.js aquarium visualization. It combines independent fish schools, water ripples, coral growth animation, and a tunable control drawer into a browser-based 3D aquarium that feels more alive.

Live demo: [https://seanwong17.github.io/RippleAquarium/](https://seanwong17.github.io/RippleAquarium/)

![Ripple Aquarium demo](./assets/demo.gif)

## Features

- The sardine school uses boids-style behavior for alignment, cohesion, separation, obstacle avoidance, and boundary steering.
- Koi fish form an independent school. They share the sardine movement logic, but have separate count, speed, and behavior controls.
- Clownfish are bottom-dwelling fish that patrol around coral and the small water region above it.
- The water surface uses a height-field simulation. Fish near the waterline, mouse clicks, and mouse drags can all trigger ripples.
- Corals grow from zero count and zero size into the default reef whenever the page is opened or refreshed.
- The right-side drawer can be collapsed and exposes Chinese controls for fish, water, coral, lighting, and visual tuning.
- The default camera is positioned closer to the aquarium for presentation.

## Run

This is a static Three.js ESM project. Run it with a local static server:

```bash
python3 -m http.server 8001
```

Then open:

```text
http://127.0.0.1:8001/index.html
```

## Controls

- Click the water surface to create a ripple.
- Hold and drag on the water surface to create continuous ripples.
- Use the right-side button to hide or show the control drawer.
- Press Space to switch between the orbit camera and the fish camera.
- Press `1` / `2` to show or hide UI panels.

## Credits And References

This project integrates, adapts, and redesigns ideas from three public/open-source projects:

- [vibe-motion/threejs-boids](https://github.com/vibe-motion/threejs-boids): the base project for the fish-school behavior, sardine-style boids movement, Three.js scene, and instanced fish rendering.
- [aisparkedu/ripple](https://github.com/aisparkedu/ripple): used as a reference for interactive water-ripple behavior, adapted here into mouse-triggered and fish-triggered aquarium surface waves.
- [Jaydeep-P/aquarium](https://github.com/Jaydeep-P/aquarium): used as a visual reference for the aquarium theme, coral, clownfish, and koi direction. Coral and clownfish model assets in this project come from that project; koi were eventually implemented as a procedural body and pattern derived from the sardine movement model.

If you redistribute or deploy this project, keep these credits and review the license requirements of the upstream projects as well.

## License

This project is licensed under the [GNU Affero General Public License v3.0](./LICENSE).
