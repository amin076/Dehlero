import fs from "fs";

const content = `
export const assetRegistry = {
  astronomy: {
    planets: {},
    moons: {},
    spacecraft: {},
    telescopes: {},
  },

  optics: {
    lenses: {},
    mirrors: {},
  },

  earthScience: {
    satellites: {},
  },

  physics: {},
};
`;

fs.writeFileSync(
  "src/assets/registry/assetRegistry.ts",
  content.trimStart(),
  "utf8"
);

console.log("assetRegistry.ts created.");
