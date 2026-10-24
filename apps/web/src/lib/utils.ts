import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Said wherever we email someone: mail filters often catch these. */
export const SPAM_HINT = "Not there? Check your spam or junk folder.";
