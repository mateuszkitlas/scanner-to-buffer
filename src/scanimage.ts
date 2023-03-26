import { Errors, Spawn, spawn } from "./utils";

type Common = Pick<Spawn, "timeout" | "onError" | "logger"> & { prependCmd?: string[] };

export const scan = async (
  o: {
    dpi?: number;
    format?: string;
    device?: string;
    mode?: string;
  } & Common
) =>
  spawn({
    ...o,
    args: [
      o.prependCmd ?? false,
      "scanimage",
      !!o.mode && ["--mode", o.mode],
      !!o.dpi && ["--resolution", o.dpi.toString()],
      !!o.format && ["--format", o.format],
      !!o.device && ["--device-name", o.device],
    ],
    onError: (ifHas, e) =>
      ifHas(Errors.busy, "Error during device I/O") ??
      ifHas(Errors.noDevice, "no SANE devices found") ??
      o.onError?.(ifHas, e),
  });

export const list = async ({ prependCmd, ...o }: Common) => {
  const rawDevices = await spawn({ ...o, args: [prependCmd ?? false, "scanimage", "-f", "%d%n"] });
  return rawDevices
    .toString()
    .split("\n")
    .filter(x => x);
};
