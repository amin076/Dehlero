# Dehlero Architecture

Dehlero is a Scientific Visualization and Video Production Studio.

## Core Pipeline

Object
→ System
→ Scene
→ Shot
→ Timeline
→ Video

## Core Modules

- engine: Three.js renderer, scene, camera, animation loop
- objects: independent scientific objects
- systems: groups of related objects
- scenes: visible worlds for preview or recording
- camera: manual and cinematic camera control
- lighting: lighting presets and editable light rigs
- director: automatic scenario, shot, and timeline generation
- video: manual and automatic recording/export
- ui: floating panels, controls, inspectors, scene selectors

## Modes

### Manual Mode

User controls the scene and camera, starts recording, moves manually, then stops and saves.

### Automatic Mode

A programmed timeline controls objects, camera, lighting, and recording.

## Design Rule

Objects must be independent.

Example:

- Saturn is an object.
- Titan is an object.
- SaturnSystem is a system.
- SaturnWithTitanVideo is a scene/timeline.

This allows Titan to appear alone, with Saturn, or in another scientific context.
