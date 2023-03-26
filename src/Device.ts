import * as scanimage from "./scanimage";
import * as powershell from "./powershell";
import * as docker from "./docker";
import { errorFrom, Errors, pick, Spawn } from "./utils";

export class Device {
  constructor(
    public readonly name: string,
    public readonly method: { kind: "docker"; container: string } | { kind: "powershell" } | { kind: "scanimage" }
  ) {}
  scan(o: { timeout?: number; dpi?: number; format?: string; mode?: string }) {
    switch (this.method.kind) {
      case "scanimage":
        return scanimage.scan({ ...o, device: this.name });
      case "powershell":
        if (o.mode) console.warn('Option "mode" omitted.');
        return powershell.scan({ ...o, format: o.format, device: this.name });
      case "docker":
        return scanimage.scan({ ...o, device: this.name, prependCmd: ["docker", "exec", this.method.container] });
    }
  }
}

export async function list(
  o?: {
    method?: { kind: "docker"; container?: string } | { kind: "powershell" } | { kind: "scanimage" };
    dockerAuto?: docker.DockerAuto;
  } & Pick<Spawn, "logger" | "timeout">
): Promise<Device[]> {
  const p = pick(o ?? {}, ["logger", "timeout"]);
  const f = (method: { kind: "docker"; container: string } | { kind: "powershell" } | { kind: "scanimage" }) => (
    devices: string[]
  ) => devices.map(name => new Device(name, method));
  switch (o?.method?.kind) {
    case "scanimage":
      return scanimage.list(p).then(f({ kind: "scanimage" }));
    case "powershell":
      return powershell.list(p).then(f({ kind: "powershell" }));
    case "docker": {
      const container = o.method.container ?? (await docker.auto({ ...p, ...o?.dockerAuto }));
      return scanimage.list({ ...p, prependCmd: ["docker", "exec", container] }).then(f({ kind: "docker", container }));
    }
    case undefined: {
      const errors: Error[] = [];
      const g = (e: unknown): Device[] => {
        errors.push(errorFrom(e));
        return [];
      };
      const [native, auto] = await Promise.all([
        list({ method: { kind: process.platform === "win32" ? "powershell" : "scanimage" }, ...p }).catch(g),
        list({ ...o, method: { kind: "docker" } }).catch(g),
      ]);
      const all = native.concat(auto);
      if (all.length || errors.length === 0) return all;
      else throw Errors.multiple(errors);
    }
  }
}
