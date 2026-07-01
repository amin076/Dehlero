import * as THREE from "three";
import type { SceneNode } from "../core/scene/SceneNode";
import type { ProgramRole, ProgramRoleMap } from "../programs/programRoles";

export type RoleBindingControllerOptions = {
  scene: THREE.Scene;
  getSelectedNode: () => SceneNode | null;
  findNodeById: (nodeId: string) => SceneNode | null;
  setStatus?: (message: string) => void;
};

const DEFAULT_ROLE_MAP: ProgramRoleMap = {
  "hero.ball": null,
  "hero.shuttle": null,
  "hero.planet": null,
  "hero.runway": null,
  "camera.main": null,
  "camera.record": null,
};

export function createRoleBindingController({
  getSelectedNode,
  findNodeById,
  setStatus,
}: RoleBindingControllerOptions) {
  let roleMap: ProgramRoleMap = { ...DEFAULT_ROLE_MAP };

  function assignSelected(role: ProgramRole) {
    const selected = getSelectedNode();

    if (!selected) {
      setStatus?.("Select an object first");
      return false;
    }

    roleMap = {
      ...roleMap,
      [role]: selected.id,
    };

    setStatus?.(`Assigned ${selected.name} as ${role}`);
    return true;
  }

  function assignNode(role: ProgramRole, node: SceneNode) {
    roleMap = {
      ...roleMap,
      [role]: node.id,
    };

    setStatus?.(`Assigned ${node.name} as ${role}`);
  }

  function clear(role: ProgramRole) {
    roleMap = {
      ...roleMap,
      [role]: null,
    };

    setStatus?.(`Cleared ${role}`);
  }

  function clearAll() {
    roleMap = { ...DEFAULT_ROLE_MAP };
    setStatus?.("Cleared all program roles");
  }

  function getNodeId(role: ProgramRole) {
    return roleMap[role] ?? null;
  }

  function getNode(role: ProgramRole) {
    const nodeId = getNodeId(role);
    return nodeId ? findNodeById(nodeId) : null;
  }

  function getObject(role: ProgramRole): THREE.Object3D | null {
    return getNode(role)?.root ?? null;
  }

  function has(role: ProgramRole) {
    return Boolean(getNode(role));
  }

  function requireObject(role: ProgramRole): THREE.Object3D {
    const object = getObject(role);

    if (!object) {
      throw new Error(`Missing required program role: ${role}`);
    }

    return object;
  }

  function getRoleMap(): ProgramRoleMap {
    return { ...roleMap };
  }

  function setRoleMap(nextRoleMap: Partial<ProgramRoleMap> | null | undefined) {
    roleMap = {
      ...DEFAULT_ROLE_MAP,
      ...(nextRoleMap ?? {}),
    };
  }

  function getMissingRoles(requiredRoles: ProgramRole[]) {
    return requiredRoles.filter((role) => !has(role));
  }

  return {
    assignSelected,
    assignNode,
    clear,
    clearAll,
    getNodeId,
    getNode,
    getObject,
    requireObject,
    has,
    getRoleMap,
    setRoleMap,
    getMissingRoles,
  };
}

export type RoleBindingController = ReturnType<
  typeof createRoleBindingController
>;