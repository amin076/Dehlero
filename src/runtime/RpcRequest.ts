export interface RpcRequest {
  id: string;
  method: string;
  payload?: unknown;
}