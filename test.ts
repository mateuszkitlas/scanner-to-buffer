import { list } from "./lib/index";
import { promises } from "fs";
import { Errors } from "./lib/utils";

(async () => {
  const logger = (x: string) => console.log(x);
  const devices = await list({
    logger,
    dockerAuto: { platform: "linux/arm64/v8", initContainer: { args: ["brsaneconfig4", "-d"] } },
  });
  const format = "png";
  console.log({ devices });
  const device = devices[0];
  try {
    const buffer = await device.scan({ format, dpi: 75 });
    await promises.writeFile("device1.bmp", buffer);
  } catch (e) {
    console.error(e);
  }
  try {
    const buffer = await device.scan({ format, dpi: 75 });
    await promises.writeFile("deviceUndefined.bmp", buffer);
  } catch (e) {
    console.error(e);
  }
  try {
    await device.scan({ format, dpi: 99 });
  } catch (e) {
    if (!Errors.invalidDPI.is(e)) console.error(e);
  }
  const s1 = device.scan({ format, dpi: 75 });
  try {
    // expect busy
    await device.scan({ format, dpi: 75 });
  } catch (e) {
    if (!Errors.busy.is(e)) console.error(e);
  }
  await s1;
  try {
    const buffer = await device.scan({ format, dpi: 75 });
    await promises.writeFile("deviceUndefined.gif", buffer);
  } catch (e) {
    console.error(e);
  }
})().catch(e => console.error(e));
