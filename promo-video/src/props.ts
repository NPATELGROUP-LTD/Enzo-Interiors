// The words someone will want to change without touching a scene: editable
// in the Remotion Studio's props panel, or with --props on the command line.
import { z } from "zod";
import { company } from "./brand/copy";

export const launchSchema = z.object({
  launchLine: z
    .string()
    .describe('Second line of the closing headline, under "New website," — e.g. "launching soon" or "live 1 October".'),
  domain: z.string().describe("The address shown on the closing button."),
  handle: z.string().describe("Instagram handle in the closing line."),
  soundtrack: z
    .string()
    .describe('Optional music: a file under public/, e.g. "audio/launch.mp3". Leave empty for a silent master (add music in Instagram).'),
});

export type LaunchProps = z.infer<typeof launchSchema>;

export const defaultLaunchProps: LaunchProps = {
  launchLine: "launching soon",
  domain: company.domain,
  handle: company.handle,
  soundtrack: "",
};

/** "launching soon" → "launching soon." — never a doubled full stop. */
export const withStop = (line: string) => `${line.trim().replace(/[.!]+$/, "")}.`;
