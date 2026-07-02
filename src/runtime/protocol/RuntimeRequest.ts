import type { RuntimeMethod } from "./RuntimeMethods";

export interface RuntimeRequest {

    id: string;

    method: RuntimeMethod;

    payload?: unknown;

}