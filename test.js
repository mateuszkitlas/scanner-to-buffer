const { scan } = require("./lib/index");
const { writeFileSync } = require("fs");

const main = async () => {
  try {
    const buffer = await scan({ format: "bmp", dpi: 75 });
    writeFileSync("file.bmp", buffer);
  } catch(e) {
    console.error(e);
  }
};

main();
