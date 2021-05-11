const { scan, list, Errors } = require("./lib/index");
const { writeFileSync } = require("fs");

const main = async () => {
  const devices = await list();
  console.log({ devices });
  try {
    const buffer = await scan({ format: "bmp", dpi: 75, device: devices[0] });
    writeFileSync("device1.bmp", buffer);
  } catch(e) {
    console.error(e);
  }
  try {
    const buffer = await scan({ format: "bmp", dpi: 75 });
    writeFileSync("deviceUndefined.bmp", buffer);
  } catch(e) {
    console.error(e);
  }
  try {
    await scan({ format: "bmp", dpi: 99 });
  } catch(e) {
    if (e.code !== Errors.invalidDPI.code) {
      console.error(e);
    }
  }
  const s1 = scan({ format: "bmp", dpi: 75 });
  try { // expect busy
    await scan({ format: "bmp", dpi: 75 });
  } catch(e) {
    if (e.code !== Errors.busy.code) {
      console.error(e);
    }
  }
  await s1;
  try {
    const buffer = await scan({ format: "gif", dpi: 75 });
    writeFileSync("deviceUndefined.gif", buffer);
  } catch(e) {
    console.error(e);
  }
};

main();
