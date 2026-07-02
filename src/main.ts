import "./style.css";
import { createStudioApp } from "./app/createStudioApp";
import { RuntimeServer } from "./runtime/server/RuntimeServer";

createStudioApp({
  root: document.querySelector<HTMLDivElement>("#app")!,
});

const runtimeServer = new RuntimeServer(4010);
runtimeServer.start();
