import { spawn, ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';

export interface Options {
  dpi: number;
  format: 'png' | 'jpeg' | 'tiff' | 'gif' | 'bmp' | 'pnm';
  timeout?: number;
  device?: string;
}

export namespace Errors {
  const e = (msg: string, code: number) => {
    const err = new Error(msg);
    (err as any).code = code;
    return err;
  }
  export const connect = e("connect error", -1);
  export const timeout = e("timeout error", -2);
  export const busy = e("the device is busy", -3);
  export const noDevice = e("no device found", -4);
  export const windowsNoFormat = e("windows cannot recognize this format", -5);
  export const invalidDPI = e("invalid DPI", -6);
}
export const defaultTimeout = 60 * 1000;

const toBuffer = (proc: ChildProcessByStdio<null, Readable, Readable>, timeout?: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on('data', (chunk) => stdout.push(chunk));
    proc.stderr.on('data', (chunk) => stderr.push(chunk));
    const handler = (timeout || defaultTimeout)
      ? setTimeout(() => {
        proc.kill();
        reject(Errors.timeout);
      }, (timeout || defaultTimeout))
      : undefined;
    proc.on('close', (code) => {
      code === 0
        ? resolve(Buffer.concat(stdout))
        : reject(Buffer.concat(stderr).toString())
      if (handler) {
        clearTimeout(handler);
      }
    });
  });

const ife = (err: any, throwErr: Error, str1: string, str2 = "") => {
  if (typeof err === "string" && err.includes(str1) && err.includes(str2)) {
    throw throwErr;
  }
}
const wrapErr = (err: any) => {
  if (typeof err === "string") {
    throw new Error(err);
  } else {
    throw err;
  }
}

const run = (cmd: string, ...args: string[]) => spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })

const powershell = (data: string) => run("powershell.exe", '-NoProfile', '-Command', `& {${data}}`)

const windowsScan = async (o: Options) => {
  const formats = { bmp: 'AB', png: 'AF', gif: 'B0', jpeg: 'AE', tiff: 'B1' } as Record<string, string>;
  const fid = (x: string) => `{B96B3C${x}-0728-11D3-9D7B-0000F81EF32E}`
  const formatID = formats[o.format];
  if (formatID === undefined) {
    throw Errors.windowsNoFormat;
  }
  try {
    return await toBuffer(powershell(`
      $ErrorActionPreference = "Stop"
      $deviceManager = new-object -ComObject WIA.DeviceManager
      ${o.device
        ? `$device = $deviceManager.DeviceInfos | where DeviceID -eq "${o.device}"`
        : "$device = $deviceManager.DeviceInfos.Item(1)"
      }
      $deviceConnected = $device.Connect()
      foreach ($item in $deviceConnected.Items) {
        foreach($prop in $item.Properties){
          if(($prop.PropertyID -eq 6147) -or ($prop.PropertyID -eq 6148)){ $prop.Value = "${o.dpi}" }
        }
      }
      $imageProcess = new-object -ComObject WIA.ImageProcess
      foreach ($item in $deviceConnected.Items) {
        $image = $item.Transfer()
      }
      $imageProcess.Filters.Add($imageProcess.FilterInfos.Item("Convert").FilterID)
      $imageProcess.Filters.Item(1).Properties.Item("FormatID").Value = "${fid(formatID)}"
      $imageProcess.Filters.Item(1).Properties.Item("Quality").Value = 5
      $image = $imageProcess.Apply($image)
      $bytes = $image.FileData.BinaryData
      [System.Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)
    `), o.timeout);
  } catch(err) {
    ife(err, Errors.invalidDPI, "At line:8 char:76", "The parameter is incorrect.");
    ife(err, Errors.connect, "At line:5", "An unspecified error occurred during an attempted communication with the WIA device.");
    ife(err, Errors.busy, "At line:5", "The WIA device is busy.");
    wrapErr(err);
  }
};

const linuxScan = async (o: Options) => {
  const device = o.device ? [`--device-name=${o.device}`] : [];
  try {
    return await toBuffer(
      run('scanimage', '--mode', 'Color', '--resolution', o.dpi.toString(), '--format', o.format, ...device),
      o.timeout,
    );
  } catch(err) {
    ife(err, Errors.busy, "Error during device I/O");
    ife(err, Errors.noDevice, "no SANE devices found");
    wrapErr(err);
  }
}

export const scan = (o: Options) => {
  switch (process.platform) {
    case 'win32':
      return windowsScan(o);
    case 'linux':
      return linuxScan(o);
    default:
      throw new Error(`not implemented for platform ${process.platform}`);
  }
};

const windowsList = async (timeout?: number) => {
  const rawDevices = await toBuffer(powershell(`
    $ErrorActionPreference = "Stop"
    $deviceManager = new-object -ComObject WIA.DeviceManager
    $deviceManager.DeviceInfos | ForEach-Object -Process {$_.DeviceId}
  `), timeout);
  return rawDevices.toString().split("\r\n").filter(x => x);
}

const linuxList = async (timeout?: number) => {
  const rawDevices = await toBuffer(run("scanimage", "-f", "%d%n"), timeout);
  return rawDevices.toString().split("\n").filter(x => x);
}
  
export const list = (timeout?: number) => {
  switch (process.platform) {
    case 'win32':
      return windowsList(timeout);
    case 'linux':
      return linuxList(timeout);
    default:
      throw new Error(`not implemented for platform ${process.platform}`);
  }
}
