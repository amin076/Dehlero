import { types } from "@theatre/core";
import type { ISheetObject } from "@theatre/core";
import studioModule from "@theatre/studio";
import type { IStudio } from "@theatre/studio";
import type {
  TheatreInternalStudio,
  TheatrePrimitivePath,
} from "./studioTypes";

export const studio = (
  (studioModule as unknown as { default?: IStudio }).default ?? studioModule
) as IStudio;

export const studioInitialization = Promise.resolve(
  studio.initialize({
    persistenceKey: "dehlero-theatre-studio-v2",
  }) as unknown as void | Promise<void>,
);

studio.ui.restore();

export function numberProp(value: number, range: [number, number]) {
  return types.number(value, { range });
}

export function getTheatreInternalStudio(): TheatreInternalStudio | null {
  const bundle = (
    window as Window & {
      __TheatreJS_StudioBundle?: { _studio?: TheatreInternalStudio };
    }
  ).__TheatreJS_StudioBundle;

  const internalStudio = bundle?._studio;

  return internalStudio && typeof internalStudio.transaction === "function"
    ? internalStudio
    : null;
}

export function sequenceTheatrePrimitiveProps(
  theatreObject: ISheetObject<any>,
  paths: TheatrePrimitivePath[],
) {
  const internalStudio = getTheatreInternalStudio();

  if (!internalStudio) {
    throw new Error("Theatre sequencing API is unavailable");
  }

  internalStudio.transaction(({ stateEditors }) => {
    paths.forEach((pathToProp) => {
      stateEditors.coreByProject.historic.sheetsById.sequence.setPrimitivePropAsSequenced(
        {
          ...theatreObject.address,
          pathToProp,
        },
      );
    });
  });
}

export function cleanupDuplicateTheatreShotPanes() {
  const bundle = (
    window as Window & {
      __TheatreJS_StudioBundle?: {
        _studio?: {
          paneManager?: {
            _getAllPanes?: () => {
              getValue: () => Record<
                string,
                {
                  instanceId: string;
                  definition?: { class?: string };
                }
              >;
            };
            destroyPane?: (pane: { instanceId: string }) => void;
          };
        };
      };
    }
  ).__TheatreJS_StudioBundle;

  const panePrism = bundle?._studio?.paneManager?._getAllPanes?.();
  const panes = panePrism ? Object.values(panePrism.getValue()) : [];

  const shotPanes = panes.filter(
    (pane) => pane.definition?.class === "dehlero-shot-director",
  );

  shotPanes.slice(1).forEach((pane) => {
    bundle?._studio?.paneManager?.destroyPane?.(pane);
  });
}
