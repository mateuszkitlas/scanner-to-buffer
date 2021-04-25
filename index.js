const { spawn } = require("child_process");
const { writeFileSync } = require("fs");
const ps = `
$deviceManager = new-object -ComObject WIA.DeviceManager
$device = $deviceManager.DeviceInfos.Item(1).Connect()
foreach ($item in $device.Items) {   
    foreach($prop in $item.Properties){  
        if(($prop.PropertyID -eq 6147) -or ($prop.PropertyID -eq 6148)){ $prop.Value = "75" }  
    }  
} 
$imageProcess = new-object -ComObject WIA.ImageProcess
foreach ($item in $device.Items) {
    $image = $item.Transfer() 
}
$imageProcess.Filters.Add($imageProcess.FilterInfos.Item("Convert").FilterID)
$imageProcess.Filters.Item(1).Properties.Item("FormatID").Value = "{B96B3CAF-0728-11D3-9D7B-0000F81EF32E}"
$imageProcess.Filters.Item(1).Properties.Item("Quality").Value = 5
$image = $imageProcess.Apply($image)
$bytes = $image.FileData.BinaryData
[System.Console]::OpenStandardOutput().Write($bytes, 0, $bytes.Length)
`;
const proc = spawn(
    `powershell.exe`,
    ["-NoProfile", "-Command", `& {${ps}}`],
    { stdio: ["ignore", "pipe", "pipe" ] },
);
const chunks = [];
proc.stdout.on("data", chunk => chunks.push(chunk))
proc.on("close", code => {
    writeFileSync("file.png", Buffer.concat(chunks));
});
