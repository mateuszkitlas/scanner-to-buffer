import { spawn, Spawn, firstLine, trimN } from "./utils";

export type DockerAuto = {
  image?: string;
  platform?: string;
  dockerfileContent?: string;
  initContainer?: Pick<Spawn, "args" | "stdin" | "timeout">;
} & Pick<Spawn, "logger" | "timeout">;

export const auto = async ({ logger, initContainer, timeout, ...o }: DockerAuto) => {
  const image = o.image ?? "scanner-to-buffer";
  const dockerfileContent =
    o.dockerfileContent ??
    trimN(6)`
      FROM amd64/ubuntu
      RUN apt-get update
      RUN apt-get install -y sane wget inetutils-ping
      RUN wget https://download.brother.com/welcome/dlf105200/brscan4-0.4.11-1.amd64.deb
      RUN dpkg -i brscan4-0.4.11-1.amd64.deb
    `;
  const common = { image, logger, timeout };
  if (!(await imageExists(common))) await build({ ...common, dockerfileContent });
  const container = (await findContainer(common)) ?? (await runContainer(common));
  if (initContainer)
    await spawn({ ...common, ...initContainer, args: ["docker", "exec", container, ...initContainer.args] });
  return container;
};

export const runContainer = async ({ image, logger }: { image: string } & Pick<Spawn, "logger">) =>
  (await firstLine(spawn({ args: ["docker", "run", "--detach", "--tty", image], logger })))!;

export const findContainer = async ({ image, logger }: { image: string } & Pick<Spawn, "logger">) =>
  firstLine(spawn({ args: ["docker", "ps", "--quiet", "--filter", `ancestor="${image}"`], logger }));

export const build = ({
  logger,
  ...o
}: { image: string; platform?: string; dockerfileContent: string } & Pick<Spawn, "logger">) =>
  spawn({
    args: ["docker", "build", !!o?.platform && ["--platform", o.platform], "-t", o.image, "-"],
    stdin: o.dockerfileContent,
    logger,
  });

export const imageExists = async ({ image, logger }: { image: string } & Pick<Spawn, "logger">) =>
  0 < (await spawn({ args: ["docker", "images", "-q", image], logger })).length;
