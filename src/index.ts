import { spawn, ChildProcessByStdio } from 'child_process';
import type { Readable } from 'stream';

export interface Options {
  dpi: number;
  format: 'png' | 'jpg' | 'tiff' | 'gif' | 'bmp';
  timeout?: number;
}

export const defaultTimeout = 60 * 1000;

const toBuffer = (proc: ChildProcessByStdio<null, Readable, Readable>, timeout: number) =>
  new Promise<Buffer>((resolve, reject) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on('data', (chunk) => stdout.push(chunk));
    proc.stderr.on('data', (chunk) => stderr.push(chunk));
    const handler = timeout
      ? setTimeout(() => {
        proc.kill();
        reject("timeout");
      }, timeout)
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

export const windows = (o: Options) => {
  const formatID = {
    bmp: '{B96B3CAB-0728-11D3-9D7B-0000F81EF32E}',
    png: '{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}',
    gif: '{B96B3CB0-0728-11D3-9D7B-0000F81EF32E}',
    jpg: '{B96B3CAE-0728-11D3-9D7B-0000F81EF32E}',
    tiff: '{B96B3CB1-0728-11D3-9D7B-0000F81EF32E}',
  }[o.format];
  const ps = `
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
  const proc = spawn(`powershell.exe`, ['-NoProfile', '-Command', `& {${ps}}`], { stdio: ['ignore', 'pipe', 'pipe'] });
  return toBuffer(proc, o.timeout || defaultTimeout);
};

export const linux = (o: Options) =>
  toBuffer(
    spawn('scanimage', ['--mode', 'Color', '--resolution', o.dpi.toString(), '--format', 'png'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
    o.timeout || defaultTimeout,
  );

export const scan = (o: Options) => {
  switch (process.platform) {
    case 'win32':
      return windows(o);
    case 'linux':
      return linux(o);
    default:
      throw new Error(`not implemented for platform ${process.platform}`);
  }
};
