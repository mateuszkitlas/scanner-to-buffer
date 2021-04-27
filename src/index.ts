import { spawn, ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';

export interface Options {
  dpi: number;
  format: 'png' | 'jpg' | 'tiff' | 'gif' | 'bmp';
  timeout?: number;
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
        reject("timeout");
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

const run = (cmd: string, ...args: string[]) => spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })

const windowsScan = (o: Options) => {
  const fid = (x: string) => `{B96B3C${x}-0728-11D3-9D7B-0000F81EF32E}`
  const formatID = fid({ bmp: 'AB', png: 'AF', gif: 'B0', jpg: 'AE', tiff: 'B1' }[o.format]);
  const ps = `
    $ErrorActionPreference = "Stop"
    $deviceManager = new-object -ComObject WIA.DeviceManager
    $device = $deviceManager.DeviceInfos.Item(1).Connect()
    foreach ($item in $device.Items) {
      foreach($prop in $item.Properties){
        if(($prop.PropertyID -eq 6147) -or ($prop.PropertyID -eq 6148)){ $prop.Value = "${o.dpi}" }
      }
    }
    $imageProcess = new-object -ComObject WIA.ImageProcess
    foreach ($item in $device.Items) {
      $image = $item.Transfer()
    }
    $imageProcess.Filters.Add($imageProcess.FilterInfos.Item("Convert").FilterID)
    $imageProcess.Filters.Item(1).Properties.Item("FormatID").Value = "${formatID}"
    $imageProcess.Filters.Item(1).Properties.Item("Quality").Value = 5
    $image = $imageProcess.Apply($image)
    $bytes = $image.FileData.BinaryData
    [System.Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)
  `;
  return toBuffer(
    run("powershell.exe", '-NoProfile', '-Command', `& {${ps}}`),
    o.timeout
  );
};

const linuxScan = (o: Options) =>
  toBuffer(
    run('scanimage', '--mode', 'Color', '--resolution', o.dpi.toString(), '--format', 'png'),
    o.timeout,
  );

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

const linuxList = async (timeout?: number) => {
  const rawDevices = await toBuffer(run("scanimage", "-f", "%d%n"), timeout);
  return rawDevices.toString().split("\n").filter(x => x);
}

export const list = (timeout?: number) => {
  switch (process.platform) {
    case 'linux':
      return linuxList(timeout);
    default:
      throw new Error(`not implemented for platform ${process.platform}`);
  }
}
