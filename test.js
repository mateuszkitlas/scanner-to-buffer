const { scan, list } = require("./lib/index");
const { writeFileSync } = require("fs");

const main = async () => {
  const devices = await list();
  console.log({ devices });
  try {
    const buffer = await scan({ format: "bmp", dpi: 75 });
    writeFileSync("file.bmp", buffer);
  } catch(e) {
    console.error(e);
  }
};

main();
