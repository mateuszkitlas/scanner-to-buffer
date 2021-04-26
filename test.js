const { scan } = require("./lib/index");
const { writeFileSync } = require("fs");

const main = async () => {
  const buffer = await scan({ format: "bmp", dpi: 75 });
  writeFileSync("file.bmp", buffer);
};

main();
