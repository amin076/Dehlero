import "./style.css";
import { createStudioApp } from "./app/createStudioApp";

createStudioApp({
  root: document.querySelector<HTMLDivElement>("#app")!,
});
