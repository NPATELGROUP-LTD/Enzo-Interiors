import { draftMode } from "next/headers";
import { redirect } from "next/navigation";

/** Ends a preview: this browser sees the site as the public does again. */
export async function GET(): Promise<Response> {
  (await draftMode()).disable();
  redirect("/");
}
