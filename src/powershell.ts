import { Errors, satisfies, Spawn, spawn, trimN } from "./utils";

const powershell = ({ script, ...o }: { script: string } & Pick<Spawn, "onError" | "timeout" | "logger">) =>
  spawn({ ...o, args: ["powershell.exe", "-NoProfile", "-Command", `& {${script}}`] });

const formats = satisfies<Partial<Record<string, string>>>({
  bmp: "AB",
  png: "AF",
  gif: "B0",
  jpeg: "AE",
  tiff: "B1",
});
const fid = (x: string) => `{B96B3C${x}-0728-11D3-9D7B-0000F81EF32E}`;

export const scan = async ({
  timeout,
  logger,
  ...o
}: {
  dpi?: number;
  format?: string;
  device?: string;
} & Pick<Spawn, "logger" | "timeout">) => {
  const formatID = formats[o.format ?? "png"];
  if (formatID === undefined) throw Errors.windowsNoFormat(o.format!);
  return powershell({
    script: trimN(6)`
      $ErrorActionPreference = "Stop"
      $deviceManager = new-object -ComObject WIA.DeviceManager
      ${
        o.device
          ? `$device = $deviceManager.DeviceInfos | where DeviceID -eq "${o.device}"`
          : "$device = $deviceManager.DeviceInfos.Item(1)"
      }
      $deviceConnected = $device.Connect()
      foreach ($item in $deviceConnected.Items) {
        foreach($prop in $item.Properties){
          if(($prop.PropertyID -eq 6147) -or ($prop.PropertyID -eq 6148)){ $prop.Value = "${o.dpi ?? 150}" }
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
      [System.Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)`,
    timeout,
    logger,
    onError: ifHas =>
      ifHas(Errors.invalidDPI, "At line:8 char:76", "The parameter is incorrect.") ??
      ifHas(
        Errors.connect,
        "At line:5",
        "An unspecified error occurred during an attempted communication with the WIA device."
      ) ??
      ifHas(Errors.busy, "At line:5", "The WIA device is busy."),
  });
};

export const list = async (o: Pick<Spawn, "logger" | "timeout">) => {
  const rawDevices = await powershell({
    ...o,
    script: trimN(6)`
      $ErrorActionPreference = "Stop"
      $deviceManager = new-object -ComObject WIA.DeviceManager
      $deviceManager.DeviceInfos | ForEach-Object -Process {$_.DeviceId}`,
  });
  return rawDevices
    .toString()
    .split("\r\n")
    .filter(x => x);
};
