import fs from "fs";
import path from "path";

const folders = [
  "public/assets",

  "public/assets/astronomy",
  "public/assets/astronomy/planets",
  "public/assets/astronomy/moons",
  "public/assets/astronomy/spacecraft",
  "public/assets/astronomy/telescopes",

  "public/assets/optics",
  "public/assets/optics/lenses",
  "public/assets/optics/mirrors",

  "public/assets/earth-science",
  "public/assets/earth-science/satellites",

  "public/assets/physics",

  "src/assets",
  "src/assets/core",
  "src/assets/registry",
];

folders.forEach((folder) => {
  fs.mkdirSync(folder, { recursive: true });
});

console.log("Asset library structure created.");
