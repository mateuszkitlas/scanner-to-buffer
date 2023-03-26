scanner-to-buffer
----

I needed a crossplatform js code, that would enable me to use my scanner - so I decided to publish my work.

It's been tested on:
  - operating systems:
    - macOS 13.2.1 with Apple Chip M1
    - Windows 11
    - ubuntu 20
  - scanners:
    - Brother DCP-1610W
    - HP DeskJet 2600

I hate writing documentation. Just contact me.

## Install

```
$ npm install scanner-to-buffer
```

## Example

```ts
import { list } from "scanner-to-buffer";
import { promises } from "fs";

const devices = await list();
const buffer = await devices[0].scan();
await promises.writeFile("outputFile", buffer);
```

## Scan options

```ts
scan(o?: {
  timeout?: number;
  dpi?: number;
  format?: string;
  mode?: string // not working in windows unless with docker
})
```

## Docker

Some manufacturers don't provide drivers for every system - so I added a feature to use docker.
```ts
// build image if needed
const devices1 = await list({
  logger: msg => console.log(msg),
  method: { kind: "docker" },
  dockerAuto: {
    image: "scanner-to-buffer",
    platform: "linux/arm64/v8",
    dockerfileContent: [
      "FROM amd64/ubuntu",
      "RUN apt-get update",
      "RUN apt-get install -y sane wget inetutils-ping",
      "RUN wget https://download.brother.com/welcome/dlf105200/brscan4-0.4.11-1.amd64.deb",
      "RUN dpkg -i brscan4-0.4.11-1.amd64.deb",
    ].join("\n"),
    initContainer: { args: ["brsaneconfig4", "-d"] }
  }
});
// use running container
const devices2 = await list({
  logger: msg => console.log(msg),
  method: { kind: "docker", container: "44a1b2f1c35d" },
});
```
