import type { ProgramDefinition } from "./programTypes";
import { createTitanWorldCupTrailer01 } from "./titan-worldcup/titanWorldCupTrailer01";

export const programRegistry: ProgramDefinition[] = [
  {
    id: "titan-worldcup-trailer-01",
    name: "Titan World Cup Trailer 01",
    description: "Football hover + shuttle launch cinematic test.",
    create: createTitanWorldCupTrailer01,
  },
];

export function getProgramById(id: string) {
  return programRegistry.find((program) => program.id === id) ?? null;
}