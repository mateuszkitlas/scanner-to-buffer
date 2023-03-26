import * as cp from "child_process";
import type { Readable } from "stream";

export const satisfies = <T>(t: T) => t;

export type Eval<T> = T extends unknown ? { [k in keyof T]: T[k] } : never;

export const firstLine = async (buffer: Promise<Buffer>) =>
  satisfies<string | undefined>(
    (await buffer)
      .toString()
      .replace("\r", "")
      .split("\n")
      .filter(x => x)[0]
  );

export const trimN = (n: number) => (
  template: { raw: readonly string[] | ArrayLike<string> },
  ...substitutions: any[]
) =>
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  String.raw(template, ...substitutions)
    .split("\n")
    .slice(1)
    .map(x => x.slice(n))
    .join("\n");

export namespace Errors {
  const is = (code: number) => (e: unknown) => e instanceof ScannerToBufferError && e.code === code;
  export class ScannerToBufferError extends Error {
    constructor(message: string, public code: number) {
      super(message);
    }
    is = is(this.code);
  }
  const arg = <T = string>(code: number, f: (t: T) => string) => {
    const g = (t: T) => new ScannerToBufferError(f(t), code);
    g.code = code;
    g.is = is(code);
    return f;
  };
  export const connect = new ScannerToBufferError("connect error", -1);
  export const timeout = new ScannerToBufferError("timeout error", -2);
  export const busy = new ScannerToBufferError("the device is busy", -3);
  export const noDevice = new ScannerToBufferError("no device found", -4);
  export const windowsNoFormat = arg(-5, format => `windows cannot recognize format ${format}`);
  export const invalidDPI = new ScannerToBufferError("invalid DPI", -6);
  export const notImplemented = arg(-7, platform => `not implemented for platform ${platform}`);
  export const multiple = arg(
    -8,
    (errors: Error[]) => `multiple errors: ${errors.map((e, i) => `${i}. ${e.name} ${e.message}`).join("")}`
  );
}

const toBuffer = (
  proc: cp.ChildProcessByStdio<any, Readable, Readable>,
  timeout?: number,
  logger?: (msg: string) => void
) =>
  new Promise<Buffer>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    logger?.("$ " + proc.spawnargs.join(" "));
    proc.stdout.on("data", (chunk: Buffer) => {
      logger?.("1: " + chunk.toString());
      stdout.push(chunk);
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      logger?.("2: " + chunk.toString());
      stderr.push(chunk);
    });
    const handler = timeout
      ? setTimeout(() => {
          reject(Errors.timeout);
          proc.kill() || proc.kill(-9);
        }, timeout)
      : undefined;
    proc.on("close", code => {
      code === 0 ? resolve(Buffer.concat(stdout)) : reject(Buffer.concat(stderr).toString());
      clearTimeout(handler);
    });
    proc.on("error", reject);
  });

const spawnRaw = (o: { args: (string | false | string[])[]; stdin?: string }) => {
  const [cmd, ...args] = o.args.flatMap(x => (typeof x === "string" ? [x] : x === false ? [] : x));
  if (o.stdin) {
    const p = cp.spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    p.stdin.setDefaultEncoding("utf-8");
    p.stdin.write(o.stdin);
    p.stdin.end();
    return p;
  } else return cp.spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
};

export const pick = <T, K extends keyof T>(t: T, keys: K[]) =>
  Object.fromEntries(keys.map(k => [k, t[k]])) as Pick<T, K>;

export type Spawn = Parameters<typeof spawn>[0];

export const spawn = ({
  timeout,
  logger,
  onError,
  ...o
}: {
  args: (string | false | string[])[];
  stdin?: string;
  timeout?: number;
  logger?: (msg: string) => void;
  onError?: (
    ifHas: (e: Errors.ScannerToBufferError, ...text: string[]) => undefined | Errors.ScannerToBufferError,
    e: Error
  ) => undefined | Errors.ScannerToBufferError;
}) =>
  toBuffer(spawnRaw(o), timeout, logger).catch(e => {
    const err = errorFrom(e);
    throw onError?.((e, ...text) => (text.every(t => t.includes(err.message)) ? e : undefined), err) ?? err;
  });

export const errorFrom = (e: unknown) => {
  if (e instanceof Error) return e;
  const error = new Error(has(e, "message", "string") ? e.message : String(e));
  error.stack = has(e, "stack", "string") ? e.stack : undefined;
  error.name = has(e, "name", "string") ? e.name : "unknown";
  return error;
};

interface TypeByLiteral {
  object: Record<keyof any, unknown> | null;
  string: string;
  function: (...args: any[]) => any;
  number: number;
  undefined: undefined;
  boolean: boolean;
}

const isRecord = <T>(o: T): o is T & Record<keyof any, unknown> => o !== null && typeof o === "object";

function has<O, K extends string>(o: O, k: K): o is O & Record<K, unknown>;
function has<O, K extends string, T extends keyof TypeByLiteral>(
  o: O,
  k: K,
  t: T
): o is O & Record<K, TypeByLiteral[T]>;
function has<O, K extends string, T extends keyof TypeByLiteral>(
  o: O,
  k: K,
  t?: T
): o is O & Record<K, TypeByLiteral[T] | unknown> {
  return isRecord(o) && (t ? typeof o[k] === t : k in o);
}
